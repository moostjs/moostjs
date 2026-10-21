import type { getContextInjector } from '@wooksjs/event-core'

import type { TContextInjectorHook } from './types'

/**
 * @internal Tells the context injector (instrumentation, e.g. OpenTelemetry) which handler an
 * event runs: `Handler:routed` with its `route` (when the adapter's router did not already),
 * then `Controller:registered` once the controller context is set.
 */
export function announceHandler(
  ci: ReturnType<typeof getContextInjector<TContextInjectorHook>>,
  kind: string,
  route?: string,
): void {
  if (!ci) {
    return
  }
  if (route !== undefined) {
    ci.hook(kind, 'Handler:routed', route)
  }
  ci.hook(kind, 'Controller:registered' as 'Handler:routed')
}
