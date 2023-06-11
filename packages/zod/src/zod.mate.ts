import { getMoostMate } from 'moost'
import { TFunction, TPrimitives } from 'common'
import { z } from 'zod'

/**
 * Get Mate instance with zod-specific types (TZodMate)
 * @returns Mate
 */
export function getZodMate() {
    return getMoostMate<TZodMate, TZodMate, TZodMate>()
}

export interface TZodMate {
    zodType?: z.ZodType
    zodCoerce?: true
    zodLazy?: () => TFunction
    zodArray?: (() => TFunction | z.ZodType | TPrimitives | [TFunction | z.ZodType | TPrimitives, ...(TFunction | z.ZodType | TPrimitives)[]])
    zodFn?: ((type: z.ZodType | z.ZodString) => z.ZodType | z.ZodString)[]
    default?: unknown
}
