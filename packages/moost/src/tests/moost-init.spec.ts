// oxlint-disable max-classes-per-file, max-lines -- one isolated controller per test case
import { describe, it, expect } from 'vitest'

import { Controller, ImportController } from '../decorators/controller.decorator'
import { HandlerPaths } from '../decorators/handler-paths.decorator'
import { Injectable } from '../decorators/injectable.decorator'
import { InjectMoost, MoostInit } from '../decorators/init.decorator'
import { getHandlerPaths, useHandlerPaths } from '../handler-paths'
import { getMoostMate } from '../metadata'
import type { TMoostAdapter, TMoostAdapterOptions } from '../moost'
import { Moost } from '../moost'

/**
 * Minimal handler decorator + adapter so these tests stay self-contained
 * (no @moostjs/event-http dependency). `FakeGet` marks a method as a handler;
 * `fakeRouteAdapter` registers it, populating `registeredAs` in the overview —
 * exactly the data a real adapter produces and an init hook reads.
 */
function FakeGet(path?: string) {
  return getMoostMate().decorate('handlers', { type: 'FAKE', path }, true)
}

const fakeRouteAdapter: TMoostAdapter<unknown> = {
  name: 'fake-route',
  bindHandler(opts: TMoostAdapterOptions<unknown, object>) {
    for (const h of opts.handlers) {
      const fullPath = `${opts.prefix}/${h.path ?? ''}`.replace(/\/+/g, '/')
      opts.register(h, fullPath, [])
    }
  },
}

describe('@MoostInit', () => {
  it('runs once after bind, with a complete controllers overview', async () => {
    const seen: string[][] = []

    @Controller('a')
    class A {
      @MoostInit()
      init(@InjectMoost() moost: Moost) {
        seen.push(moost.getControllersOverview().map((c) => c.type.name))
      }
    }

    @Controller('b')
    class B {}

    const app = new Moost()
    app.registerControllers(A, B)
    await app.init()

    expect(seen).toHaveLength(1) // exactly once
    // overview is COMPLETE: the hook sees its own controller AND later-bound ones
    expect(seen[0]).toContain('A')
    expect(seen[0]).toContain('B')
  })

  it('resolves the controller’s own mounted (prefixed) route at init', async () => {
    let resolvedPath: string | undefined

    @Controller('api/auth')
    class Auth {
      @FakeGet('refresh')
      refresh() {
        return 'ok'
      }

      @MoostInit()
      init(@InjectMoost() moost: Moost) {
        const overview = moost.getControllersOverview().find((c) => c.type.name === 'Auth')
        resolvedPath = overview?.handlers[0]?.registeredAs[0]?.path
      }
    }

    const app = new Moost()
    app.adapter(fakeRouteAdapter)
    app.registerControllers(Auth)
    await app.init()

    expect(resolvedPath).toBe('/api/auth/refresh')
  })

  it('supports constructor injection of Moost', async () => {
    let captured: Moost | undefined

    @Controller('c')
    class C {
      constructor(private readonly moost: Moost) {}

      @MoostInit()
      init() {
        captured = this.moost
      }
    }

    const app = new Moost()
    app.registerControllers(C)
    await app.init()

    expect(captured).toBe(app)
  })

  it('runs hooks in ascending priority order', async () => {
    const order: string[] = []

    @Controller()
    class Ord {
      @MoostInit({ priority: 10 })
      last() {
        order.push('p10')
      }

      @MoostInit({ priority: -5 })
      first() {
        order.push('p-5')
      }

      @MoostInit({ priority: 0 })
      mid() {
        order.push('p0')
      }
    }

    const app = new Moost()
    app.registerControllers(Ord)
    await app.init()

    expect(order).toEqual(['p-5', 'p0', 'p10'])
  })

  it('runs before adapter.onInit', async () => {
    const log: string[] = []

    @Controller()
    class D {
      @MoostInit()
      init() {
        log.push('init-hook')
      }
    }

    const adapter: TMoostAdapter<unknown> = {
      name: 'fake',
      bindHandler() {},
      onInit() {
        log.push('adapter-onInit')
      },
    }

    const app = new Moost()
    app.adapter(adapter)
    app.registerControllers(D)
    await app.init()

    expect(log).toEqual(['init-hook', 'adapter-onInit'])
  })

  it('awaits async init hooks', async () => {
    let done = false

    @Controller()
    class E {
      @MoostInit()
      async init() {
        await new Promise((resolve) => setTimeout(resolve, 10))
        done = true
      }
    }

    const app = new Moost()
    app.registerControllers(E)
    await app.init()

    expect(done).toBe(true)
  })

  it('throws at bind for a FOR_EVENT controller', async () => {
    @Injectable('FOR_EVENT')
    class F {
      @MoostInit()
      init() {
        /* unreachable */
      }
    }

    const app = new Moost()
    app.registerControllers(F)
    await expect(app.init()).rejects.toThrow(/FOR_EVENT/)
  })

  it('rejects init() when a hook throws (fail-fast)', async () => {
    @Controller()
    class G {
      @MoostInit()
      init() {
        throw new Error('boom')
      }
    }

    const app = new Moost()
    app.registerControllers(G)
    await expect(app.init()).rejects.toThrow('boom')
  })
})

describe('handler path helpers', () => {
  it('getHandlerPaths returns a method’s actual mounted path', async () => {
    let paths: string[] = []

    @Controller('api/auth')
    class Auth {
      @FakeGet('refresh')
      refresh() {}

      @MoostInit()
      init(@InjectMoost() moost: Moost) {
        paths = getHandlerPaths(moost, Auth, 'refresh')
      }
    }

    const app = new Moost()
    app.adapter(fakeRouteAdapter)
    app.registerControllers(Auth)
    await app.init()

    expect(paths).toEqual(['/api/auth/refresh'])
  })

  it('@HandlerPaths injects the mounted path(s) into a @MoostInit param', async () => {
    let injected: string[] = []

    @Controller('api/auth')
    class Auth {
      @FakeGet('refresh')
      refresh() {}

      @MoostInit()
      init(@HandlerPaths('refresh') paths: string[]) {
        injected = paths
      }
    }

    const app = new Moost()
    app.adapter(fakeRouteAdapter)
    app.registerControllers(Auth)
    await app.init()

    expect(injected).toEqual(['/api/auth/refresh'])
  })

  it('useHandlerPaths resolves from the current controller context', async () => {
    let paths: string[] = []

    @Controller('api/auth')
    class Auth {
      @FakeGet('refresh')
      refresh() {}

      @MoostInit()
      async init() {
        paths = await useHandlerPaths('refresh')
      }
    }

    const app = new Moost()
    app.adapter(fakeRouteAdapter)
    app.registerControllers(Auth)
    await app.init()

    expect(paths).toEqual(['/api/auth/refresh'])
  })

  it('returns all distinct paths for a multi-mounted controller', async () => {
    let paths: string[] = []

    @Controller('sub')
    class Sub {
      @FakeGet('ping')
      ping() {}
    }

    @Controller('root')
    @ImportController('a', Sub)
    @ImportController('b', Sub)
    class Root {
      @MoostInit()
      init(@InjectMoost() moost: Moost) {
        paths = getHandlerPaths(moost, Sub, 'ping')
      }
    }

    const app = new Moost()
    app.adapter(fakeRouteAdapter)
    app.registerControllers(Root)
    await app.init()

    expect(paths.toSorted()).toEqual(['/root/a/ping', '/root/b/ping'])
  })

  it('memoizes the handler-overview index (built once, reused)', async () => {
    @Controller('m')
    class M {
      @FakeGet('x')
      x() {}
    }

    const app = new Moost()
    app.adapter(fakeRouteAdapter)
    app.registerControllers(M)
    await app.init()

    // same reference across calls → no per-call rescan of the overview
    const index = app.getHandlerOverviewIndex()
    expect(index).toBe(app.getHandlerOverviewIndex())
    const handlers = index.get(M)?.get('x') ?? []
    expect(handlers.flatMap((h) => h.registeredAs.map((r) => r.path))).toEqual(['/m/x'])
  })

  it('returns an empty array when the method has no registered paths', async () => {
    let paths: string[] = ['sentinel']

    @Controller('x')
    class X {
      @MoostInit()
      init(@InjectMoost() moost: Moost) {
        paths = getHandlerPaths(moost, X, 'nope')
      }
    }

    const app = new Moost()
    app.adapter(fakeRouteAdapter)
    app.registerControllers(X)
    await app.init()

    expect(paths).toEqual([])
  })
})
