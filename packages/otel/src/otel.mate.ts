import { getMoostMate, type TMoostMetadata, type Mate, type TMateParamMeta } from 'moost'

export interface TOtelMate {
  otelIgnoreSpan: boolean
  otelIgnoreMeter: boolean
}

export function getOtelMate(): Mate<
  TMoostMetadata &
    TOtelMate & {
      params: Array<TOtelMate & TMateParamMeta>
    },
  TMoostMetadata &
    TOtelMate & {
      params: Array<TOtelMate & TMateParamMeta>
    }
> {
  return getMoostMate<TOtelMate, TOtelMate, TOtelMate>()
}
