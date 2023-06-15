import { TFunction } from 'common'
import { getMoostMate } from 'moost'
import { z } from '@moostjs/zod'
import { TSwaggerSchema } from './mapping'

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
    contentType: string
    response: TSwaggerResponseConfigValue
}

export type TSwaggerResponseOpts = TSwaggerResponseConfigValue | TSwaggerResponseConfig
