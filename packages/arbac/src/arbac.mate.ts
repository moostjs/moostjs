import { getMoostMate } from 'moost'
import type { TMoostMetadata, Mate, TMateParamMeta } from 'moost'

export interface TArbacMeta {
  arbacResourceId?: string
  arbacActionId?: string
  arbacPublic?: boolean
}

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
