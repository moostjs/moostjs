import { getMoostMate } from 'moost'
import type { TMoostMetadata, Mate, TMateParamMeta } from 'moost'

export interface TOtelMate {
  otelIgnoreSpan: boolean
  otelIgnoreMeter: boolean
}

export function getOtelMate(): Mate<
  TMoostMetadata &
    TOtelMate & {
      params: (TOtelMate & TMateParamMeta)[]
    },
  TMoostMetadata &
    TOtelMate & {
      params: (TOtelMate & TMateParamMeta)[]
    }
> {
  return getMoostMate<TOtelMate, TOtelMate, TOtelMate>()
}
