import type { TEmpty, TFunction } from 'common'

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
  | 'Inteceptors:init'
  | 'Arguments:resolve'
  | 'Inteceptors:before'
  | 'Handler'
  | 'Inteceptors:after'
