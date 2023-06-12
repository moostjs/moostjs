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
    zodFn?: TZodFunction[]
    default?: unknown
}

export type TZodFunction = ((type: z.ZodType | z.ZodString) => z.ZodType | z.ZodString)

export type TZodMetadata = ReturnType<ReturnType<typeof getZodMate>['read']>
