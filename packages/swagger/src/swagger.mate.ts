import { getMoostMate } from 'moost'
import type { TMoostMetadata, Mate, TMateParamMeta } from 'moost'

import type { TFunction } from './common-types'
import type { TSwaggerSchema } from './mapping'

export function getSwaggerMate(): Mate<
  TMoostMetadata &
    TSwaggerMate & {
      params: TMateParamMeta[]
    },
  TMoostMetadata &
    TSwaggerMate & {
      params: TMateParamMeta[]
    }
> {
  return getMoostMate<TSwaggerMate, TSwaggerMate>()
}

export interface TSwaggerMate {
  swaggerTags: string[]
  swaggerExclude: boolean
  swaggerDescription: string
  swaggerResponses: Record<
    number,
    Record<string, { response: TSwaggerConfigType; example?: unknown }>
  >
  swaggerRequestBody: Record<string, TSwaggerConfigType>
  swaggerExample?: unknown
  swaggerParams: {
    name: string
    in: 'query' | 'header' | 'path' | 'formData' | 'body'
    description?: string
    required?: boolean
    type?: TSwaggerConfigType
  }[]
}

export type TSwaggerConfigType = TFunction | { toJsonSchema?: () => unknown } | TSwaggerSchema

interface TSwaggerResponseConfig {
  contentType?: string
  description?: string
  response: TSwaggerConfigType
}

export type TSwaggerResponseOpts = TSwaggerConfigType | TSwaggerResponseConfig
