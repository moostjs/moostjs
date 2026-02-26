import type { EventContext } from '@wooksjs/event-core'
import { current, key } from '@wooksjs/event-core'

import type { TAny } from '../common-types'

/** Callback used by interceptors to short-circuit and replace the handler response. */
export type TOvertakeFn = (response: TAny) => void

// Use globalThis to ensure a single key instance even when this module is loaded
// from both source and dist (dual-package hazard in tests).
const g = globalThis as TAny
const overtakeKey = (g.__moost_overtakeKey ??= key<TOvertakeFn>('interceptor.overtake'))
const interceptResultKey = (g.__moost_interceptResultKey ??= key<unknown>('interceptor.result'))

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
