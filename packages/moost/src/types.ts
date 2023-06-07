import { TEmpty } from 'common'
import { TMoostHandler, TMoostMetadata } from './metadata'

export interface TControllerOverview {
    meta: TMoostMetadata
    computedPrefix: string
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
