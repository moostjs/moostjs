import { TAny, TClassConstructor, TObject } from 'common'
import { TMoostAdapter } from '../moost'
import { TMoostMetadata } from '../metadata'
import { TPipeData } from '../pipes'
import { TConsoleBase } from '@prostojs/logger'

export interface TBindControllerOptions {
    getInstance: () => Promise<TObject>
    classConstructor: TClassConstructor
    adapters: TMoostAdapter<TAny>[]
    globalPrefix?: string
    replaceOwnPrefix?: string
    provide?: TMoostMetadata['provide']
    interceptors?: TMoostMetadata['interceptors']
    pipes?: TPipeData[]
    logger: TConsoleBase
}
