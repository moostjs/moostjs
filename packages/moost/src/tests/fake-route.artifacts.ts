import { createEventContext } from '@wooksjs/event-core'

import { defineMoostEventHandler } from '../adapter-utils'
import { getMoostInfact, getMoostMate } from '../metadata'
import type { TMoostAdapter, TMoostAdapterOptions } from '../moost'
import { Moost } from '../moost'

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

/** A silent logger for event contexts in specs. */
export const testLogger = { info() {}, warn() {}, error() {}, debug() {} }

/** The DI scopes currently registered in the moost container. */
export function scopes() {
  return (getMoostInfact() as unknown as { scopes: Map<string, unknown> }).scopes
}

/** Binds every FAKE handler to a moost event handler, runnable by its path. */
export function capturingAdapter() {
  const handlers = new Map<string, () => unknown>()
  const adapter: TMoostAdapter<unknown> = {
    name: 'capture',
    bindHandler<T extends object>(opts: TMoostAdapterOptions<unknown, T>) {
      for (const h of opts.handlers) {
        const path = `/${opts.prefix}/${h.path ?? ''}`.replace(/\/+/g, '/')
        handlers.set(
          path,
          defineMoostEventHandler({
            loggerTitle: 'test',
            getIterceptorHandler: opts.getIterceptorHandler,
            getControllerInstance: opts.getInstance,
            controllerMethod: opts.method,
            resolveArgs: opts.resolveArgs,
            targetPath: path,
            handlerType: 'FAKE',
          }),
        )
      }
    },
  }
  /** Runs the handler of `path` in a fresh event; returns what it returns (sync or a promise). */
  const call = (path: string) => {
    const handler = handlers.get(path)
    if (!handler) {
      throw new Error(`no handler for ${path}`)
    }
    return createEventContext({ logger: testLogger }, handler)
  }
  return { adapter, call }
}

/** A booted app with the given controllers bound to a {@link capturingAdapter}. */
export async function boot(...controllers: Function[]) {
  const { adapter, call } = capturingAdapter()
  const app = new Moost()
  app.adapter(adapter)
  app.registerControllers(...controllers)
  await app.init()
  return { app, call }
}
