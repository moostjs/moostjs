import type { EventContext } from '@wooksjs/event-core'
import { current } from '@wooksjs/event-core'

import type { TAny } from '../common-types'
import { globalKey } from './global-key'

/** Callback used by interceptors to short-circuit and replace the handler response. */
export type TOvertakeFn = (response: TAny) => void

// Interned via globalKey so the slot stays a single instance across duplicate
// moost loads (dual ESM/CJS, or duplicate installs).
const overtakeKey = globalKey<TOvertakeFn>('interceptor.overtake')
const interceptResultKey = globalKey<unknown>('interceptor.result')

/** Stores the overtake (reply) function in the current event context. */
export function setOvertake(fn: TOvertakeFn, ctx?: EventContext) {
  ;(ctx || current()).set(overtakeKey, fn)
}

/** Retrieves the overtake (reply) function from the current event context. */
export function useOvertake(ctx?: EventContext): TOvertakeFn {
  return (ctx || current()).get(overtakeKey)
}

/** Stores the interceptor result value in the current event context. */
export function setInterceptResult(value: unknown, ctx?: EventContext) {
  ;(ctx || current()).set(interceptResultKey, value)
}

/** Retrieves the interceptor result value from the current event context. */
export function useInterceptResult<T = unknown>(ctx?: EventContext): T {
  return (ctx || current()).get(interceptResultKey) as T
}
