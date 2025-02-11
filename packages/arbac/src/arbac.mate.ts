import { getMoostMate, type TMoostMetadata, type Mate, type TMateParamMeta } from 'moost'

export interface TArbacMeta {
  arbacResourceId?: string
  arbacActionId?: string
  arbacPublic?: boolean
}

export function getArbacMate(): Mate<
  TMoostMetadata &
    TArbacMeta & {
      params: Array<TMateParamMeta>
    },
  TMoostMetadata &
    TArbacMeta & {
      params: Array<TMateParamMeta>
    }
> {
  return getMoostMate<TArbacMeta, TArbacMeta>()
}
