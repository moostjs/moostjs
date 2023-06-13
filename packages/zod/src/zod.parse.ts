import { TObject } from 'common'
import { z } from 'zod'

export interface TZodParsedBase {
    $optional?: boolean
    $nullable?: boolean
    $getDefault?: () => unknown
}

export interface TZodParsedString extends TZodParsedBase { $type: 'ZodString' }
export interface TZodParsedNumber extends TZodParsedBase { $type: 'ZodNumber' }
export interface TZodParsedBigInt extends TZodParsedBase { $type: 'ZodBigInt' }
export interface TZodParsedBoolean extends TZodParsedBase { $type: 'ZodBoolean' }
export interface TZodParsedDate extends TZodParsedBase { $type: 'ZodDate' }
export interface TZodParsedSymbol extends TZodParsedBase { $type: 'ZodSymbol' }
export interface TZodParsedUndefined extends TZodParsedBase { $type: 'ZodUndefined' }
export interface TZodParsedNull extends TZodParsedBase { $type: 'ZodNull' }
export interface TZodParsedAny extends TZodParsedBase { $type: 'ZodAny' }
export interface TZodParsedUnknown extends TZodParsedBase { $type: 'ZodUnknown' }
export interface TZodParsedNever extends TZodParsedBase { $type: 'ZodNever' }
export interface TZodParsedVoid extends TZodParsedBase { $type: 'ZodVoid' }
export interface TZodParsedNaN extends TZodParsedBase { $type: 'ZodNaN' }

export interface TZodParsedEnum extends TZodParsedBase {
    $type: 'ZodEnum'
    $value: string[]
}

export interface TZodParsedNativeEnum extends TZodParsedBase {
    $type: 'ZodNativeEnum'
    $value: Record<string, string | number>
}

export interface TZodParsedLiteral extends TZodParsedBase {
    $type: 'ZodLiteral'
    $value: string
}

export interface TZodParsedArray extends TZodParsedBase {
    $type: 'ZodArray'
    $inner: TZodParsed
}

export interface TZodParsedUnion extends TZodParsedBase {
    $type: 'ZodUnion'
    $inner: TZodParsed[]
}
export interface TZodParsedIntersection extends TZodParsedBase {
    $type: 'ZodIntersection'
    $inner: TZodParsed[]
}
export interface TZodParsedRecord extends TZodParsedBase {
    $type: 'ZodRecord'
    $inner: TZodParsed[]
}
export interface TZodParsedMap extends TZodParsedBase {
    $type: 'ZodMap'
    $inner: TZodParsed[]
}

export interface TZodParsedDiscriminatedUnion extends TZodParsedBase {
    $type: 'ZodDiscriminatedUnion'
    $inner: TZodParsed[]
    $value: { discriminator: string, optionsMap: Map<string, TZodParsed> }
}

export interface TZodParsedObject extends TZodParsedBase {
    $type: 'ZodObject'
    $inner: Record<string, TZodParsed>
}

export interface TZodParsedTuple extends TZodParsedBase {
    $type: 'ZodTuple'
    $inner: TZodParsed[]
    $value: { hasRest: boolean }
}

export interface TZodParsedSet extends TZodParsedBase {
    $type: 'ZodSet'
    $inner: TZodParsed
}

export interface TZodParsedFunction extends TZodParsedBase {
    $type: 'ZodFunction'
    $args: TZodParsedTuple
    $returns: TZodParsed
}

type TZodParsed =
    | TZodParsedString
    | TZodParsedNumber
    | TZodParsedBigInt
    | TZodParsedBoolean
    | TZodParsedDate
    | TZodParsedSymbol
    | TZodParsedUndefined
    | TZodParsedNull
    | TZodParsedAny
    | TZodParsedUnknown
    | TZodParsedNever
    | TZodParsedVoid
    | TZodParsedNaN
    | TZodParsedEnum
    | TZodParsedNativeEnum
    | TZodParsedLiteral
    | TZodParsedArray
    | TZodParsedUnion
    | TZodParsedDiscriminatedUnion
    | TZodParsedObject
    | TZodParsedTuple
    | TZodParsedSet
    | TZodParsedFunction
    | TZodParsedIntersection
    | TZodParsedRecord
    | TZodParsedMap

type TZodParsedAll = {
    $type: string
}
    & Partial<
        & Omit<TZodParsedString, '$type'>
        & Omit<TZodParsedNumber, '$type'>
        & Omit<TZodParsedBigInt, '$type'>
        & Omit<TZodParsedBoolean, '$type'>
        & Omit<TZodParsedDate, '$type'>
        & Omit<TZodParsedSymbol, '$type'>
        & Omit<TZodParsedUndefined, '$type'>
        & Omit<TZodParsedNull, '$type'>
        & Omit<TZodParsedAny, '$type'>
        & Omit<TZodParsedUnknown, '$type'>
        & Omit<TZodParsedNever, '$type'>
        & Omit<TZodParsedVoid, '$type'>
        & Omit<TZodParsedNaN, '$type'>
        & Omit<TZodParsedEnum, '$type'>
        & Omit<TZodParsedNativeEnum, '$type'>
        & Omit<TZodParsedLiteral, '$type'>
        & Omit<TZodParsedArray, '$type'>
        & Omit<TZodParsedUnion, '$type'>
        & Omit<TZodParsedDiscriminatedUnion, '$type'>
        & Omit<TZodParsedObject, '$type'>
        & Omit<TZodParsedTuple, '$type'>
        & Omit<TZodParsedSet, '$type'>
        & Omit<TZodParsedFunction, '$type'>
        & Omit<TZodParsedIntersection, '$type'>
        & Omit<TZodParsedRecord, '$type'>
        & Omit<TZodParsedMap, '$type'>>

export function parseZodType<T = TZodParsed>(
    zt: z.ZodType,
    cb?: (p: TZodParsed) => T,
    opts: { $optional?: boolean, $nullable?: boolean, $value?: unknown, $args?: T, $returns?: T, $get?: () => T, $getDefault?: (() => unknown) } = {}
): T {
    const mergeParsedData = (data: TZodParsedAll | { $inner?: T | T[] | Record<string, T> }, newOpts?: typeof opts): TZodParsed => {
        (data as TZodParsedAll).$type = (zt as z.ZodString)._def.typeName || '-'
        return Object.assign(data, { ...(opts || {}), ...(newOpts || {}) }) as TZodParsed
    }

    const callCb = (cb || ((v) => v)) as (p: TZodParsed) => T

    if (zt instanceof z.ZodObject) {
        const shape: Record<string, T> = {}
        for (const [key, field] of Object.entries(zt.shape as TObject)) {
            shape[key] = parseZodType<T>(field as z.ZodType, cb)
        }
        return callCb(mergeParsedData({ $inner: shape }))
    }

    if (zt instanceof z.ZodArray) {
        return callCb(mergeParsedData({ $inner: parseZodType<T>(zt.element as z.ZodType, cb) }))
    }

    if (zt instanceof z.ZodTuple) {
        return callCb(
            mergeParsedData(
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                { $inner: [...zt._def.items, ...(zt._def.rest && [zt._def.rest] || [])].map((item: z.ZodType) => parseZodType<T>(item, cb)) },
                { $value: { hasRest: !!zt._def.rest } }
            )
        )
    }

    if (zt instanceof z.ZodRecord || zt instanceof z.ZodMap) {
        return callCb(
            mergeParsedData({
                $inner: [zt._def.keyType, zt._def.valueType].map((option: z.ZodType) => parseZodType<T>(option, cb)),
            })
        )
    }

    if (zt instanceof z.ZodSet) {
        return callCb(mergeParsedData({ $inner: parseZodType<T>(zt._def.valueType as z.ZodType, cb) }))
    }

    if (zt instanceof z.ZodPromise) {
        return callCb(mergeParsedData({ $inner: parseZodType<T>(zt._def.type as z.ZodType, cb) }))
    }

    if (zt instanceof z.ZodEffects) {
        return parseZodType<T>(zt._def.schema as z.ZodType, cb, opts)
    }

    if (zt instanceof z.ZodCatch) {
        return parseZodType<T>(zt._def.innerType as z.ZodType, cb, opts)
    }

    if (zt instanceof z.ZodBranded) {
        return parseZodType<T>(zt._def.type as z.ZodType, cb, opts)
    }

    if (zt instanceof z.ZodPipeline) {
        return parseZodType<T>(zt._def.in as z.ZodType, cb, opts)
    }

    if (zt instanceof z.ZodDefault) {
        return parseZodType<T>(zt._def.innerType as z.ZodType, cb, { ...(opts || {}), $getDefault: zt._def.defaultValue })
    }

    if (zt instanceof z.ZodOptional) {
        return parseZodType<T>(zt.unwrap() as z.ZodType, cb, { ...(opts || {}), $optional: true })
    }

    if (zt instanceof z.ZodNullable) {
        return parseZodType<T>(zt.unwrap() as z.ZodType, cb, { ...(opts || {}), $nullable: true })
    }

    if (zt instanceof z.ZodLazy) {
        return callCb(mergeParsedData({}, { $get: () => parseZodType<T>(zt._def.getter() as z.ZodType, cb) }))
    }

    if (zt instanceof z.ZodFunction) {
        return callCb(mergeParsedData({}, { $args: parseZodType<T>(zt._def.args as z.ZodTuple, cb), $returns: parseZodType<T>(zt._def.returns as z.ZodType, cb) }))
    }

    if (zt instanceof z.ZodUnion) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        return callCb(mergeParsedData({ $inner: (zt.options as z.ZodType[]).map((option: z.ZodType) => parseZodType<T>(option, cb)) }))
    }

    if (zt instanceof z.ZodDiscriminatedUnion) {
        return callCb(
            mergeParsedData(
                { $inner: (zt.options as z.ZodType[]).map((option: z.ZodType) => parseZodType<T>(option, cb)) },
                { $value: { discriminator: zt._def.discriminator as z.ZodType, optionsMap: new Map(Array.from(zt._def.optionsMap, ([key, value]) => [key, parseZodType<T>(value, cb)])) } }
            )
        )
    }

    if (zt instanceof z.ZodIntersection) {
        return callCb(mergeParsedData({ $inner: [zt._def.left, zt._def.right].map((option: z.ZodType) => parseZodType<T>(option, cb)) }))
    }

    if (zt instanceof z.ZodEnum) {
        return callCb(mergeParsedData({}, { $value: zt._def.values }))
    }

    if (zt instanceof z.ZodNativeEnum) {
        return callCb(mergeParsedData({}, { $value: zt._def.values }))
    }

    if (zt instanceof z.ZodLiteral) {
        return callCb(mergeParsedData({}, { $value: zt._def.value }))
    }

    return callCb(mergeParsedData({}))
}
