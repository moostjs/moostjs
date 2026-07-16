import { getMoostMate } from '../metadata'
import type { Moost, TMoostAdapter, TMoostAdapterOptions } from '../moost'

/**
 * Test fixtures: a minimal handler decorator + route adapter so specs stay
 * self-contained (no @moostjs/event-http dependency). `FakeGet` marks a method
 * as a handler; `fakeRouteAdapter` registers it the way a real router does
 * (leading slash ensured, duplicate slashes collapsed), populating
 * `registeredAs` in the controllers overview.
 */
export function FakeGet(path?: string) {
  return getMoostMate().decorate('handlers', { type: 'FAKE', path }, true)
}

export const fakeRouteAdapter: TMoostAdapter<unknown> = {
  name: 'fake-route',
  bindHandler<T extends object>(opts: TMoostAdapterOptions<unknown, T>) {
    for (const h of opts.handlers) {
      const fullPath = `/${opts.prefix}/${h.path ?? ''}`.replace(/\/+/g, '/')
      opts.register(h, fullPath, [])
    }
  },
}

/** The named controller's mounted paths from the overview, sorted. */
export function registeredPaths(app: Moost, name: string): string[] {
  const overview = app.getControllersOverview().find((c) => c.type.name === name)
  return (overview?.handlers.flatMap((h) => h.registeredAs.map((r) => r.path)) ?? []).toSorted()
}
