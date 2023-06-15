import { TEmpty, TFunction } from 'common'
import { TMoostHandler, TMoostMetadata } from './metadata'

export interface TControllerOverview {
    meta: TMoostMetadata
    computedPrefix: string
    type: TFunction
    handlers: THandlerOverview[]
}

export interface THandlerOverview {
    meta: TMoostMetadata
    path?: string
    type: string
    method: string
    handler: TMoostHandler<TEmpty>
    registeredAs: {path: string, args: string[]}[]
}
