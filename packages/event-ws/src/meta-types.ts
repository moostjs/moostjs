import { getMoostMate } from 'moost'
import type { TMoostMetadata, Mate, TMateParamMeta } from 'moost'

export interface TWsClassMeta {
  params?: TWsClassMeta[]
}

export function getWsMate(): Mate<
  TMoostMetadata &
    TWsClassMeta & {
      params: TMateParamMeta[]
    },
  TMoostMetadata &
    TWsClassMeta & {
      params: TMateParamMeta[]
    }
> {
  return getMoostMate<TWsClassMeta, TWsClassMeta>()
}
