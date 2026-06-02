import { getConstructor, isConstructor } from '@prostojs/mate'

import type { TClassConstructor, TFunction, TObject } from './common-types'
import { useControllerContext } from './composables'
import { resolveMoost } from './decorators/resolve-moost'
import type { Moost } from './moost'
import type { THandlerOverview } from './types'

export interface TGetHandlerPathsOptions {
  /** Restrict to handlers of this event type, e.g. `'HTTP'`. */
  type?: string
  /**
   * Custom predicate to select handlers — keeps event-specific knowledge out of
   * core, e.g. filter by HTTP verb: `(h) => (h.handler as { method: string }).method === 'GET'`.
   */
  predicate?: (handler: THandlerOverview) => boolean
}

/**
 * Resolves the handler-overview records for `ctor.method`. Uses Moost's memoized
 * index when available (the fast path for a real `Moost` instance), and otherwise
 * derives them from `getControllersOverview()` — so the helper also works with a
 * minimal Moost-like object that only implements that documented method (e.g. a
 * test stub or a lightweight harness).
 */
function resolveHandlers(moost: Moost, ctor: TFunction, method: string): THandlerOverview[] {
  const getIndex = (moost as Partial<Pick<Moost, 'getHandlerOverviewIndex'>>)
    .getHandlerOverviewIndex
  if (typeof getIndex === 'function') {
    return getIndex.call(moost).get(ctor)?.get(method) ?? []
  }
  const handlers: THandlerOverview[] = []
  for (const c of moost.getControllersOverview()) {
    if (c.type !== ctor) {
      continue
    }
    for (const h of c.handlers) {
      if (h.method === method) {
        handlers.push(h)
      }
    }
  }
  return handlers
}

/**
 * Returns every actual mounted path under which `controller.method` is registered,
 * read from the post-bind controllers overview. Accounts for multi-prefix mounts
 * (`@ImportController` at several places), multiple verbs on one method, and
 * multiple `registeredAs` entries. Returns **distinct** paths; empty array if none
 * match.
 *
 * Only meaningful after `Moost.init()` has bound controllers — typically called
 * from a `@MoostInit` method (see [MoostInit](./decorators/init.decorator.ts)).
 *
 * @param controller class constructor or instance whose method to look up
 * @param method controller method name (e.g. the one carrying `@Get('refresh')`)
 */
export function getHandlerPaths(
  moost: Moost,
  controller: TClassConstructor | TObject,
  method: string,
  opts?: TGetHandlerPathsOptions,
): string[] {
  const ctor = (isConstructor(controller) ? controller : getConstructor(controller)) as TFunction
  const handlers = resolveHandlers(moost, ctor, method)
  if (handlers.length === 0) {
    return []
  }
  const { type, predicate } = opts ?? {}
  const paths = new Set<string>()
  for (const h of handlers) {
    if (type && h.type !== type) {
      continue
    }
    if (predicate && !predicate(h)) {
      continue
    }
    for (const r of h.registeredAs) {
      paths.add(r.path)
    }
  }
  return [...paths]
}

/**
 * Composable form of {@link getHandlerPaths}. Resolves the running Moost app and
 * defaults the controller to the current one from context — designed for use
 * inside a `@MoostInit` method or an event handler. `method` defaults to the
 * current context method; pass it explicitly from `@MoostInit` to target a
 * handler method (the init method itself is not a handler).
 */
export async function useHandlerPaths(
  method?: string,
  opts?: TGetHandlerPathsOptions,
): Promise<string[]> {
  const moost = await resolveMoost()
  const { getController, getMethod } = useControllerContext()
  return getHandlerPaths(moost, getController() as TObject, method ?? getMethod() ?? '', opts)
}
