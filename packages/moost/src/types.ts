import type { TEmpty, TFunction } from './common-types'
import type { TMoostHandler, TMoostMetadata } from './metadata'

/** Summary of a registered controller, its metadata, prefix, and handlers. */
export interface TControllerOverview {
  meta: TMoostMetadata
  computedPrefix: string
  type: TFunction
  handlers: THandlerOverview[]
}

/** Summary of a registered handler method within a controller. */
export interface THandlerOverview {
  meta: TMoostMetadata
  path?: string
  type: string
  method: string
  handler: TMoostHandler<TEmpty>
  registeredAs: { path: string; args: string[] }[]
}

/** Hook points in the event handler lifecycle where context injectors are invoked. */
export type TContextInjectorHook =
  | 'Event:start'
  | 'Interceptors:init'
  | 'Arguments:resolve'
  | 'Interceptors:before'
  | 'Handler'
  | 'Interceptors:after'
