import { getMoostMate, type TMoostMetadata, type Mate, type TMateParamMeta } from 'moost'
import type { z } from 'zod'

import type { TZodOpts } from './primitives'
import { TEmpty } from './common-types'

/**
 * Get Mate instance with zod-specific types (TZodMate)
 * @returns Mate
 */
export function getZodMate(): Mate<
  TMoostMetadata<TEmpty> &
    TZodMate & {
      params: Array<TZodMate & TMateParamMeta>
    },
  TMoostMetadata<TEmpty> &
    TZodMate & {
      params: Array<TZodMate & TMateParamMeta>
    }
> {
  return getMoostMate<TZodMate, TZodMate, TZodMate>()
}

export interface TZodMate {
  zodType?: z.ZodType | ((opts?: TZodOpts) => z.ZodType)
  zodCoerce?: true
  zodPreprocess?: Array<(arg: unknown) => unknown>
  zodMarkedAsArray?: boolean
  zodFn?: TZodFunctionDefinition[]
  zodClassName?: string
  zodPropName?: string
  zodParamIndex?: number
  zodDefault?: unknown
  zodValidate?: true
  zodSkip?: boolean
  zodObj?: 'strict' | 'passthrough' | 'strip'
  default?: unknown
}

export type TZodFunction = (type: z.ZodType | z.ZodString) => z.ZodType | z.ZodString
export interface TZodFunctionDefinition {
  decorator: string
  fn: TZodFunction
}

export type TZodMetadata = ReturnType<ReturnType<typeof getZodMate>['read']>
