import { getMoostMate } from 'moost'
import type { TMoostMetadata, Mate, TMateParamMeta } from 'moost'

/** ARBAC metadata fields attached to classes and methods by ARBAC decorators. */
export interface TArbacMeta {
  arbacResourceId?: string
  arbacActionId?: string
  arbacPublic?: boolean
}

/** Returns the shared `Mate` instance extended with ARBAC metadata fields. */
export function getArbacMate(): Mate<
  TMoostMetadata &
    TArbacMeta & {
      params: TMateParamMeta[]
    },
  TMoostMetadata &
    TArbacMeta & {
      params: TMateParamMeta[]
    }
> {
  return getMoostMate<TArbacMeta, TArbacMeta>()
}
