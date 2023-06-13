import { TClassConstructor, TFunction, TObject, TPrimitives } from 'common'
import { z } from 'zod'
import { TZodFunction, TZodMetadata, getZodMate } from './zod.mate'
import { TZodOpts, resolveZodPrimitive, resolveZodPrimitiveByConstructor } from './primitives'

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
 * @param opts - Options for Zod validation.
 * @param safe - Indicates whether to use safeParseAsync for safe parsing.
 * @returns A promise that resolves to the validated data or a safe parse result.
 */
export async function validate<T extends (TObject | z.ZodType), S extends boolean>(
    data: unknown,
    dto: (new () => T) | z.ZodType<T>,
    opts?: TZodOpts,
    safe?: S,
): Promise<S extends true ? z.SafeParseReturnType<unknown, T> : T> {
    if (dto instanceof z.ZodType) {
        return (safe === true ? await dto.safeParseAsync(data) : await dto.parseAsync(data)) as unknown as Promise<S extends true ? z.SafeParseReturnType<unknown, T> : T>
    }
    const zodType = getZodType({ type: dto }, opts)
    if (zodType) {
        return await validate(data, zodType, opts, safe) as Promise<S extends true ? z.SafeParseReturnType<unknown, T> : T>
    }
    return (safe === true ? { data, success: true } as z.SafeParseReturnType<unknown, T> : data) as Promise<S extends true ? z.SafeParseReturnType<unknown, T> : T>
}

/**
 * Get ZodType for class property (method parameter)
 * 
 * @param origin - origin class, prop key and param index
 * @param target - target type and/or value to check
 * @param opts - Zod Options
 * @returns ZodType
 */
export function getZodTypeForProp(origin: { type: TFunction, key: string | symbol, index?: number }, target: { type?: TFunction, value?: unknown, additionalMeta?: TZodMetadata }, opts?: TZodOpts): z.ZodType {
    let store = cachedPropsTypes.get(origin.type)
    if (!store) {
        store = {
            props: new Map(),
            params: new Map(),
        }
    }
    if (typeof origin.index === 'number') {
        const cached = store.params.get(origin.key)
        if (!cached) {
            const zodType = getZodType(target, opts)
            const paramsArray: z.ZodType[] = []
            paramsArray[origin.index] = zodType
            store.params.set(origin.key, paramsArray)
            return zodType
        } else {
            if (!cached[origin.index]) {
                cached[origin.index] = getZodType(target, opts)
            }
            return cached[origin.index]
        }
    } else {
        const cached = store.props.get(origin.key)
        if (!cached) {
            const zodType = getZodType(target, opts)
            store.props.set(origin.key, zodType)
            return zodType
        } else {
            return cached
        }
    }
}

/**
 * Get ZodType 
 * @param target - target type and/or value to check
 * @param opts - ZodOptions
 * @returns ZodType
 */
export function getZodType(target: { type?: TFunction, value?: unknown, additionalMeta?: TZodMetadata }, opts?: TZodOpts): z.ZodType {
    const { type, value, additionalMeta } = target
    const typeOfValue = (typeof value) as TPrimitives
    const ownMeta = type && mate.read(type) || undefined
    let needToCache = false
    let toWrapIntoArray = false

    const overrideZodType = additionalMeta?.zodType
    if (!overrideZodType) {
        const cached = lookupInCache()
        if (cached) return processResult(cached)
    }
    const zodInitialType = resolveInitialType()
    return processResult(ownMeta ? applyZodFunctions(zodInitialType, {
        description: ownMeta.description,
        zodDefault: ownMeta.zodDefault,
        zodPreprocess: ownMeta.zodPreprocess,
        zodFn: ownMeta.zodFn,
    }) : zodInitialType)

    // functions:
    function lookupInCache(): z.ZodType | undefined {
        if (type) {
            return cachedTypes.get(type)
        }
    }

    function resolveInitialType(): z.ZodType {
        if (overrideZodType) {
            const overridenType = typeof overrideZodType === 'function' ? overrideZodType(opts) : overrideZodType
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
                if (isArray) toWrapIntoArray = true
                return zt
            }
            // Check primitives
            const zodType = resolveZodPrimitiveByConstructor(type, opts)
            if (zodType) return zodType

            // Since this point we want to cache ZodType by constructor
            needToCache = true
            // Checking for pre-defined meta
            if (ownMeta?.zodType) {
                return typeof ownMeta.zodType === 'function' ? ownMeta.zodType(opts) : ownMeta.zodType
            }

            // Build a new ZodType
            const fakeInstance = (new (type as TClassConstructor)()) as TObject
            const keys = [...Object.keys(fakeInstance), ...(ownMeta?.properties || [])] as (keyof typeof fakeInstance)[]
            const shape: Record<string, z.ZodType> = {}
            for (const key of keys) {
                const propMeta = mate.read(type, key as PropertyKey)
                try {
                    shape[key] = getZodType({
                        type: propMeta?.type,
                        value: fakeInstance[key],
                        additionalMeta: propMeta,
                    }, { ...(opts || {}), coerce: (propMeta?.zodCoerce || undefined) })
                } catch (e) {
                    throw new Error(`Could not create ZodType for class "${type.name}". Type of property "${key as string}" (${propMeta?.type?.name || '' }) is unknown:\n${ (e as Error).message }`)
                }
            }
            return z.object(shape)
        } else {
            const { zt, isArray } = resolveZodTypeByValue(value, opts)
            if (isArray) toWrapIntoArray = true
            return zt
        }
    }

    function processResult(zt: z.ZodType): z.ZodType {
        if (needToCache && type && !overrideZodType) cachedTypes.set(type, zt)
        return applyZodFunctions(zt, {
            optional: additionalMeta?.optional,
            description: additionalMeta?.description,
            zodDefault: additionalMeta?.zodDefault,
            zodPreprocess: additionalMeta?.zodPreprocess,
            zodFn: additionalMeta?.zodFn,
            zodMarkedAsArrayBeforeOptional: additionalMeta?.zodMarkedAsArrayBeforeOptional,
            wrapIntoArray: additionalMeta?.zodMarkedAsArray ? false : toWrapIntoArray,
        })
    }    
}

function resolveZodTypeByValue(value: unknown, opts?: TZodOpts): { isArray?: boolean, zt: z.ZodType } {
    const type = typeof value
    if (type === 'object') {
        if (Array.isArray(value)) {
            if (value.length) {
                const subType = resolveZodTypeByValue(value[0], opts)
                return {
                    isArray: true,
                    zt: subType.isArray ? subType.zt.array() : subType.zt,
                }
            }
            throw new Error('Could not resolve array item type.')
        } else if (value === null) {
            return { zt: z.null() }
        } else if (value instanceof Date) {
            return { zt: z.date() }
        }
    }
    return { zt: resolveZodPrimitive(typeof value as TPrimitives, opts) }
}

function applyZodFunctions(type: z.ZodType, toApply: {
    optional?: boolean
    description?: string
    zodDefault?: unknown
    zodPreprocess?: ((arg: unknown) => unknown)[]
    zodFn?: TZodFunction[]
    zodMarkedAsArrayBeforeOptional?: boolean, // array was annotated after @Optional
    wrapIntoArray?: boolean // array detected, but was not annotated
}) {
    if (toApply) {
        let newType = type
        if (!toApply.wrapIntoArray && toApply.optional && !toApply.zodMarkedAsArrayBeforeOptional) {
            // array of optional smth
            newType = newType.optional()
        }
        if (toApply.zodFn && toApply.zodFn.length) {
            toApply.zodFn.forEach(zodFn => newType = zodFn(newType))
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
        if (toApply.optional && (toApply.wrapIntoArray || toApply.zodMarkedAsArrayBeforeOptional)) {
            // optional array of smth
            newType = newType.optional()
        }
        if (toApply.description) {
            newType = newType.describe(toApply.description)
        }
        if (typeof toApply.zodDefault !== 'undefined') {
            newType = newType.default(toApply.zodDefault)
        }
        return newType
    }
    return type
}
