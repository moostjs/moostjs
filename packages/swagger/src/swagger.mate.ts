import type { z } from '@moostjs/zod'
import type { TFunction } from 'common'
import { getMoostMate } from 'moost'

import type { TSwaggerSchema } from './mapping'

export function getSwaggerMate() {
  return getMoostMate<TSwaggerMate, TSwaggerMate>()
}

export interface TSwaggerMate {
  swaggerTags: string[]
  swaggerExclude: boolean
  swaggerDescription: string
  swaggerResponses: Record<number, Record<string, TSwaggerConfigType>>
  swaggerRequestBody: Record<string, TSwaggerConfigType>
  swaggerParams: Array<{
    name: string
    in: 'query' | 'header' | 'path' | 'formData' | 'body'
    description?: string
    required?: boolean
    type?: TSwaggerConfigType
  }>
}

export type TSwaggerConfigType = TFunction | z.ZodType | TSwaggerSchema

interface TSwaggerResponseConfig {
  contentType?: string
  description?: string
  response: TSwaggerConfigType
}

export type TSwaggerResponseOpts = TSwaggerConfigType | TSwaggerResponseConfig
