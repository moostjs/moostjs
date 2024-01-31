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
  swaggerResponses: Record<number, Record<string, TSwaggerResponseConfigValue>>
  swaggerRequestBody: Record<string, TSwaggerResponseConfigValue>
}

export type TSwaggerResponseConfigValue = TFunction | z.ZodType | TSwaggerSchema

interface TSwaggerResponseConfig {
  contentType?: string
  description?: string
  response: TSwaggerResponseConfigValue
}

export type TSwaggerResponseOpts = TSwaggerResponseConfigValue | TSwaggerResponseConfig
