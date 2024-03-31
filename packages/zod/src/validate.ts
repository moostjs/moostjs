/* eslint-disable sonarjs/no-nested-template-literals */
/* eslint-disable @typescript-eslint/naming-convention */
import type { TClassConstructor, TFunction, TLogger, TObject, TPrimitives } from 'common'
import { z } from 'zod'

import type { TZodOpts } from './primitives'
import { resolveZodPrimitive, resolveZodPrimitiveByConstructor } from './primitives'
import type { TZodFunctionDefinition, TZodMetadata } from './zod.mate'
import { getZodMate } from './zod.mate'

const mate = getZodMate()

const cachedTypes = new WeakMap<TFunction['prototype'], z.ZodType>()

const cachedPropsTypes = new WeakMap<TFunction['prototype'], TClassPropsMap>()

interface TClassPropsMap {
  props: Map<string | symbol, z.ZodType>
  params: Map<string | symbol, z.ZodType[]>
}

/**
 * Validates the input data against a Zod type or a class with Zod metadata.
 * @param data - The data to validate.
 * @param dto - The Zod type or class with Zod metadata.
 * @param opts - (optional) Options for Zod validation.
 * @param safe - (optional) Indicates whether to use safeParseAsync for safe parsing.
 * @param logger - (optional)
 * @returns A promise that resolves to the validated data or a safe parse result.
 */
export async function validate<T extends TObject | z.ZodType, S extends boolean>(
  data: unknown,
  dto: (new () => T) | z.ZodType<T>,
  opts?: TZodOpts,
  safe?: S,
  logger?: TLogger
): Promise<S extends true ? z.SafeParseReturnType<unknown, T> : T> {
  if (dto instanceof z.ZodType) {
    return (safe === true
      ? await dto.safeParseAsync(data)
      : await dto.parseAsync(data)) as unknown as Promise<
      S extends true ? z.SafeParseReturnType<unknown, T> : T
    >
  }
  const zodType = getZodType({ type: dto }, opts, logger)
  if (zodType) {
    return (await validate(data, zodType, opts, safe)) as Promise<
      S extends true ? z.SafeParseReturnType<unknown, T> : T
    >
  }
  return (
    safe === true ? ({ data, success: true } as z.SafeParseReturnType<unknown, T>) : data
  ) as Promise<S extends true ? z.SafeParseReturnType<unknown, T> : T>
}

/**
 * Get ZodType for class property (method parameter)
 *
 * @param origin - origin class, prop key and param index
 * @param target - target type and/or value to check
 * @param opts - (optional) Zod Options
 * @param logger - (optional)
 * @returns ZodType
 */
export function getZodTypeForProp(
  origin: { type: TFunction; key: string | symbol; index?: number },
  target: { type?: TFunction; value?: unknown; additionalMeta?: TZodMetadata },
  opts?: TZodOpts,
  logger?: TLogger
): z.ZodType {
  let store = cachedPropsTypes.get(origin.type)
  if (!store) {
    store = {
      props: new Map(),
      params: new Map(),
    }
    cachedPropsTypes.set(origin.type, store)
  }
  if (typeof origin.index === 'number') {
    const cached = store.params.get(origin.key)
    if (cached) {
      if (!cached[origin.index]) {
        cached[origin.index] = getZodType(target, opts, logger)
      }
      return cached[origin.index]
    } else {
      const zodType = getZodType(target, opts, logger)
      const paramsArray: z.ZodType[] = []
      paramsArray[origin.index] = zodType
      store.params.set(origin.key, paramsArray)
      return zodType
    }
  } else {
    const cached = store.props.get(origin.key)
    if (cached) {
      return cached
    } else {
      const zodType = getZodType(target, opts, logger)
      store.props.set(origin.key, zodType)
      return zodType
    }
  }
}

/**
 * Get ZodType
 * @param target - target type and/or value to check
 * @param opts - (optional) ZodOptions
 * @param logger - (optional)
 * @returns ZodType
 */
export function getZodType(
  target: { type?: TFunction; value?: unknown; additionalMeta?: TZodMetadata },
  opts?: TZodOpts,
  logger?: TLogger
): TMoostZodType {
  const { type, value, additionalMeta } = target
  const typeOfValue = typeof value as TPrimitives
  const ownMeta = (type && mate.read(type)) || undefined
  let needToCache = false
  let toWrapIntoArray = false

  const overrideZodType = additionalMeta?.zodType
  if (!overrideZodType) {
    const cached = lookupInCache()
    if (cached) {
      return processResult(cached)
    }
  }
  const zodInitialType = resolveInitialType()
  return processResult(
    ownMeta
      ? applyZodFunctions(
          zodInitialType,
          {
            description: ownMeta.description,
            zodDefault: ownMeta.zodDefault,
            zodPreprocess: ownMeta.zodPreprocess,
            zodFn: ownMeta.zodFn,
            zodClassName: ownMeta.zodClassName,
            zodPropName: ownMeta.zodPropName,
            zodParamIndex: ownMeta.zodParamIndex,
          },
          logger
        )
      : zodInitialType
  )

  // functions:
  function lookupInCache(): z.ZodType | undefined {
    if (type) {
      return cachedTypes.get(type)
    }
  }

  function resolveInitialType(): z.ZodType {
    if (overrideZodType) {
      const overridenType =
        typeof overrideZodType === 'function' ? overrideZodType(opts) : overrideZodType
      if (type === Array && !(overridenType instanceof z.ZodTuple)) {
        toWrapIntoArray = true
      }
      return overridenType
    }
    if (type) {
      if ((type === Object || type === Array) && typeOfValue !== 'undefined') {
        // When class prop has pre-defined value with no explicit type,
        // it results to widening type in runtime to Object.
        // This fallback results in type by value determination:
        const { zt, isArray } = resolveZodTypeByValue(value, opts)
        if (isArray) {
          toWrapIntoArray = true
        }
        return zt
      }
      // Check primitives
      const zodType = resolveZodPrimitiveByConstructor(type, opts)
      if (zodType) {
        return zodType
      }

      // Since this point we want to cache ZodType by constructor
      needToCache = true
      // Checking for pre-defined meta
      if (ownMeta?.zodType) {
        return typeof ownMeta.zodType === 'function' ? ownMeta.zodType(opts) : ownMeta.zodType
      }

      // Build a new ZodType
      const fakeInstance = new (type as TClassConstructor)() as TObject
      const keys = [...Object.keys(fakeInstance), ...(ownMeta?.properties || [])] as Array<
        keyof typeof fakeInstance
      >
      const shape: Record<string, z.ZodType> = {}
      for (const key of keys) {
        const propMeta = mate.read(type, key as PropertyKey)
        try {
          shape[key] = getZodType(
            {
              type: propMeta?.type,
              value: fakeInstance[key],
              additionalMeta: propMeta,
            },
            { ...opts, coerce: propMeta?.zodCoerce || undefined },
            logger
          )
        } catch (error) {
          throw new Error(
            `Could not create ZodType for class "${type.name}". Type of property "${
              key as string
            }" (${propMeta?.type?.name || ''}) is unknown:\n${(error as Error).message}`
          )
        }
      }
      const obj = z.object(shape)
      if (ownMeta?.zodObj === 'passthrough') {
        return obj.passthrough()
      }
      if (ownMeta?.zodObj === 'strip') {
        return obj.strip()
      }
      return obj.strict()
    } else {
      const { zt, isArray } = resolveZodTypeByValue(value, opts)
      if (isArray) {
        toWrapIntoArray = true
      }
      return zt
    }
  }

  function processResult(zt: z.ZodType): TMoostZodType {
    const toReturn = applyZodFunctions(
      zt,
      {
        optional: additionalMeta?.optional,
        description: additionalMeta?.description,
        zodDefault: additionalMeta?.zodDefault,
        zodPreprocess: additionalMeta?.zodPreprocess,
        zodFn: additionalMeta?.zodFn,
        wrapIntoArray: additionalMeta?.zodMarkedAsArray ? false : toWrapIntoArray,
        zodClassName: additionalMeta?.zodClassName,
        zodPropName: additionalMeta?.zodPropName,
        zodParamIndex: additionalMeta?.zodParamIndex,
      },
      logger
    )
    if (needToCache && type && !overrideZodType) {
      Object.assign(zt, { __type_ref: type })
      Object.assign(toReturn, { __type_ref: type })
      cachedTypes.set(type, zt)
    }
    return toReturn
  }
}

export type TMoostZodType = z.ZodType & { __type_ref?: TFunction }

function resolveZodTypeByValue(
  value: unknown,
  opts?: TZodOpts,
  logger?: TLogger
): { isArray?: boolean; zt: z.ZodType } {
  const type = typeof value
  if (type === 'object') {
    if (Array.isArray(value)) {
      if (value.length > 0) {
        const subType = resolveZodTypeByValue(value[0], opts, logger)
        return {
          isArray: true,
          zt: subType.isArray ? subType.zt.array() : subType.zt,
        }
      }
      throw new Error('Could not resolve array item type.')
    } else if (value === null) {
      return { zt: z.null(opts) }
    } else if (value instanceof Date) {
      return { zt: z.date(opts) }
    }
  }
  return { zt: resolveZodPrimitive(typeof value as TPrimitives, opts) }
}

function applyZodFunctions(
  type: z.ZodType,
  toApply: {
    optional?: boolean
    description?: string
    zodDefault?: unknown
    zodPreprocess?: Array<(arg: unknown) => unknown>
    zodFn?: TZodFunctionDefinition[]
    zodClassName?: string
    zodPropName?: string
    zodParamIndex?: number
    wrapIntoArray?: boolean // array detected, but was not annotated
  },
  logger?: TLogger
) {
  if (toApply) {
    let newType = type
    if (toApply.zodFn?.length) {
      Array.from(toApply.zodFn)
        .reverse()
        .forEach(zodFn => {
          try {
            newType = zodFn.fn(newType)
          } catch (error) {
            const cl = toApply.zodClassName!
            const prop = toApply.zodPropName!
            const i = toApply.zodParamIndex!
            const arg = typeof i === 'number'
            const message =
              `${__DYE_UNDERSCORE__}@${zodFn.decorator}${__DYE_UNDERSCORE_OFF__} skipped for ${
                arg ? `${__DYE_CYAN__}argument[${i}]${__DYE_YELLOW__} at ` : ''
              }${__DYE_CYAN__}${cl}${prop ? `.${prop}` : ''}${__DYE_YELLOW__}, ` +
              `${__DYE_UNDERSCORE__}${
                (newType._def as { typeName: string }).typeName
              }${__DYE_UNDERSCORE_OFF__} does not support such function.`
            ;(logger || console).warn(
              `${__DYE_YELLOW__}${message} ${__DYE_WHITE__ + __DYE_DIM__}Runtime error: ${
                (error as Error).message
              }${__DYE_RESET__}`
            )
          }
        })
    }
    if (toApply.zodPreprocess) {
      let prev = newType
      for (let i = toApply.zodPreprocess.length - 1; i >= 0; i--) {
        const fn = toApply.zodPreprocess[i]
        newType = z.preprocess(fn, prev)
        prev = newType
      }
    }
    if (toApply.wrapIntoArray) {
      newType = newType.array()
    }
    if (toApply.optional && !(newType instanceof z.ZodOptional) && !newType.isOptional()) {
      newType = newType.optional()
    }
    if (toApply.description) {
      newType = newType.describe(toApply.description)
    }
    if (toApply.zodDefault !== undefined) {
      newType = newType.default(toApply.zodDefault)
    }
    return newType
  }
  return type
}
