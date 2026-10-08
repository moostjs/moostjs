import type { TConsoleBase } from '@prostojs/logger'

import type { TAny, TClassConstructor, TObject } from '../common-types'
import type { TMoostMetadata } from '../metadata'
import type { Moost, TMoostAdapter } from '../moost'
import type { TPipeData } from '../pipes'
import type { TParamAuditFinding } from './param-audit'

export interface TBindControllerOptions {
  getInstance: () => Promise<TObject> | TObject
  classConstructor: TClassConstructor
  adapters: TMoostAdapter<TAny>[]
  globalPrefix?: string
  replaceOwnPrefix?: string
  provide?: TMoostMetadata['provide']
  replace?: TMoostMetadata['replace']
  interceptors?: TMoostMetadata['interceptors']
  pipes?: TPipeData[]
  logger: TConsoleBase
  moostInstance: Moost
  /** Collector for `@MoostInit` methods discovered while walking the controller. */
  registerInitHook?: (hook: TInitHook) => void
  /** Collector for D1 method-param audit findings; omit to skip the audit. */
  reportParamAudit?: (findings: TParamAuditFinding[]) => void
}

/**
 * An init hook collected for `Moost.init()`: either a `@MoostInit`-decorated
 * controller method (collected at bind time) or a function registered with
 * `Moost.addInitHook`. Interceptors are not applied; params of method hooks
 * resolve through the RESOLVE pipe only.
 */
export type TInitHook = TMethodInitHook | TFnInitHook

export interface TMethodInitHook {
  kind?: 'method'
  priority: number
  method: string
  computedPrefix: string
  getInstance: () => Promise<TObject> | TObject
  resolveArgs?: () => unknown[] | Promise<unknown[]>
}

export interface TFnInitHook {
  kind: 'fn'
  priority: number
  fn: (app: never) => unknown
}
