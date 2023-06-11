import { z } from 'zod'
import { getZodMate } from './zod.mate'
import { TClassConstructor, TFunction, TObject, TPrimitives } from 'common'

export async function validate<T extends (TObject | z.ZodType), S extends boolean>(
    data: unknown, dto: (new () => T) | z.ZodType<T>,
    opts?: TZodOpts,
    safe?: S,
): Promise<S extends true ? z.SafeParseReturnType<unknown, T> : T> {
    if (dto instanceof z.ZodType) {
        return (safe === true ? await dto.safeParseAsync(data) : await dto.parseAsync(data)) as unknown as Promise<S extends true ? z.SafeParseReturnType<unknown, T> : T>
    }
    const zodType = zodByClass(dto, opts)
    if (zodType) {
        return await validate(data, zodType, opts, safe) as Promise<S extends true ? z.SafeParseReturnType<unknown, T> : T>
    }
    return (safe === true ? { data, success: true } as z.SafeParseReturnType<unknown, T> : data) as Promise<S extends true ? z.SafeParseReturnType<unknown, T> : T>
}

const mate = getZodMate()

function createZodTypeForConstructor(target: TFunction, opts?: TZodOpts): z.ZodType {
    const classConstructor = target as TClassConstructor
    const meta = mate.read(target)
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    const fakeInstance = new classConstructor() as TObject
    const keys = [...Object.keys(fakeInstance), ...(meta?.properties || [])] as (keyof typeof fakeInstance)[]
    const shape: Record<string, z.ZodType> = {}
    for (const key of keys) {
        const val = fakeInstance[key]
        const propMeta = mate.read(target, key as PropertyKey)
        const zodOpts = { ...(opts || {}), coerce: (propMeta?.zodCoerce || meta?.zodCoerce || undefined) }
        if (propMeta?.zodType) {
            shape[key] = propMeta.zodType
        } else if (propMeta?.zodArray) {
            const fn = propMeta.zodArray
            shape[key] = z.lazy(() => {
                const types = fn()
                if (Array.isArray(types)) {
                    // tuple
                    const tuple: [z.ZodTypeAny, ...z.ZodTypeAny[]] = types.map(t => zodOrPrimitiveOrClass(t, zodOpts)) as [z.ZodTypeAny, ...z.ZodTypeAny[]]
                    return z.tuple(tuple)
                } else {
                    // array
                    return zodOrPrimitiveOrClass(types, zodOpts).array()
                }
            })
        } else if (propMeta?.zodLazy) {
            const fn = propMeta.zodLazy
            shape[key] = z.lazy(() => zodByClass(fn()))
        } else if (propMeta?.type) {
            if (propMeta.type === Object) {
                shape[key] = mapPrimitiveType(val, target.name, key, zodOpts)
            } else {
                shape[key] = zodByClass(propMeta.type, zodOpts)
            }
        } else {
            shape[key] = mapPrimitiveType(val, target.name, key, zodOpts)
        }
        if (propMeta && shape[key] instanceof z.ZodType) {
            shape[key] = applyZodModifiers(shape[key], propMeta)
        }
    }
    return applyZodModifiers(z.object(shape), meta)
}

function applyZodModifiers(type: z.ZodType, meta: ReturnType<typeof mate.read>) {
    if (meta) {
        let newType = type
        if (meta.optional) {
            newType = newType.optional()
        }
        if (meta.description) {
            newType = newType.describe(meta.description)
        }
        if (typeof meta.default !== 'undefined') {
            newType = newType.default(meta.default)
        }
        if (meta.zodFn && meta.zodFn.length) {
            meta.zodFn.forEach(zodFn => newType = zodFn(newType))
        }
        return newType
    }
    return type
}

const typeConstructorMap = new WeakMap<TFunction['prototype'], (opts?: TZodOpts) => z.ZodType>()
typeConstructorMap.set(String, (opts?: TZodOpts) => z.string(opts))
typeConstructorMap.set(Number, (opts?: TZodOpts) => z.number(opts))
typeConstructorMap.set(Boolean, (opts?: TZodOpts) => z.boolean(opts))
typeConstructorMap.set(Array, (opts?: TZodOpts) => z.array(z.unknown(), opts))
typeConstructorMap.set(Date, (opts?: TZodOpts) => z.array(z.date(), opts))
// typeConstructorMap.set(Set, z.)
// typeConstructorMap.set(Map, z.)
// typeConstructorMap.set(Promise, z.)
// typeConstructorMap.set(Function, z.)

export function zodOrPrimitiveOrClass(type: TFunction | z.ZodType | TPrimitives, opts?: TZodOpts): z.ZodType {
    if (type instanceof z.ZodType) {
        return type
    }
    if (typeof type === 'string') {
        return mapPrimitiveType(type, '', '', opts)
    }
    return zodByClass(type, opts)
}

export function zodByClass(type: TFunction, opts?: TZodOpts): z.ZodType {
    const zodFactory = typeConstructorMap.get(type)
    return zodFactory && zodFactory(opts) || resolveZodType(type, opts)
}

function resolveZodType(type: TFunction, opts?: TZodOpts): z.ZodType {
    const meta = mate.read(type)
    if (meta?.zodType) {
        return meta.zodType
    }
    const zodType = createZodTypeForConstructor(type, opts)
    typeConstructorMap.set(type, () => zodType)
    return zodType
}

const primitivesMap = new Map<string, (opts?: TZodOpts) => z.ZodType>()

primitivesMap.set('undefined', (opts?: TZodOpts) => z.undefined(opts))
primitivesMap.set('boolean', (opts?: TZodOpts) => z.boolean(opts))
primitivesMap.set('number', (opts?: TZodOpts) => z.number(opts))
primitivesMap.set('bigint', (opts?: TZodOpts) => z.bigint(opts))
primitivesMap.set('string', (opts?: TZodOpts) => z.string(opts))
primitivesMap.set('symbol', (opts?: TZodOpts) => z.symbol(opts))

function mapPrimitiveType(val: unknown, className: string, propName: string, opts?: TZodOpts): z.ZodType {
    const type = typeof val
    if (type === 'object') {
        if (Array.isArray(val)) {
            return z.array(val.length ? mapPrimitiveType(val[0], className, `${propName}[0]`, opts) : z.unknown())
        } else if (val === null) {
            return z.null()
        } else if (val instanceof Date) {
            return z.date()
        } else {
            throw new Error(`Failed to map types to Zod. Unknown type ${ className }.${ propName }`)
            // return z.unknown()
        }
    }
    const zodFactory = primitivesMap.get(type)
    return zodFactory && zodFactory(opts) || z.unknown(opts)
}

export interface TZodOpts {
    coerce?: true | undefined;
    errorMap?: z.ZodErrorMap;
    invalid_type_error?: string;
    required_error?: string;
}
