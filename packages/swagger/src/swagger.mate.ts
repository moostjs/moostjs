import { getMoostMate } from 'moost'

export function getSwaggerMate() {
    return getMoostMate<TSwaggerMate, TSwaggerMate>()
}

export interface TSwaggerMate {
    swaggerTags: string[]
    swaggerExclude: boolean
    swaggerDescription: string
}
