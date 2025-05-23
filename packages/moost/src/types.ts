import type { TEmpty, TFunction } from './common-types'
import type { TMoostHandler, TMoostMetadata } from './metadata'

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
  registeredAs: Array<{ path: string; args: string[] }>
}

export type TContextInjectorHook =
  | 'Event:start'
  | 'Interceptors:init'
  | 'Arguments:resolve'
  | 'Interceptors:before'
  | 'Handler'
  | 'Interceptors:after'
