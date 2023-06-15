import { getMoostMate } from 'moost'
import { z } from 'zod'
import { TZodOpts } from './primitives'

/**
 * Get Mate instance with zod-specific types (TZodMate)
 * @returns Mate
 */
export function getZodMate() {
    return getMoostMate<TZodMate, TZodMate, TZodMate>()
}

export interface TZodMate {
    zodType?: z.ZodType | ((opts?: TZodOpts) => z.ZodType)
    zodCoerce?: true
    zodPreprocess?: ((arg: unknown) => unknown)[]
    zodMarkedAsArray?: boolean
    zodMarkedAsArrayBeforeOptional?: boolean
    zodFn?: TZodFunctionDefinition[]
    zodClassName?: string
    zodPropName?: string
    zodParamIndex?: number
    zodDefault?: unknown
    zodSkip?: boolean
    default?: unknown
}

export type TZodFunction = ((type: z.ZodType | z.ZodString) => z.ZodType | z.ZodString)
export type TZodFunctionDefinition = { decorator: string, fn: TZodFunction }

export type TZodMetadata = ReturnType<ReturnType<typeof getZodMate>['read']>
