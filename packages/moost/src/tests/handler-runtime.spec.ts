// oxlint-disable max-classes-per-file -- one isolated controller / interceptor per test case
import { createEventContext } from '@wooksjs/event-core'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { defineMoostEventHandler } from '../adapter-utils'
import type { TMoostEventHandlerHookOptions } from '../adapter-utils'
import { setControllerContext, useControllerContext } from '../composables'
import { Before, Controller, Injectable, Intercept, Interceptor, Pipe } from '../decorators'
import { Const } from '../decorators/resolve.decorator'
import { withControllerContext } from '../event-scope'
import { getMoostInfact } from '../metadata'
import type { TMoostAdapter, TMoostAdapterOptions } from '../moost'
import { Moost } from '../moost'
import { createReplaceRegistry } from '@prostojs/infact'
import { isThenable } from '../shared-utils'
import { FakeGet } from './fake-route.artifacts'

const testLogger = { info() {}, warn() {}, error() {}, debug() {} }

/** Binds every FAKE handler to a moost event handler, runnable by its path. */
function capturingAdapter() {
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
  const call = (path: string) => createEventContext({ logger: testLogger }, handlers.get(path)!)
  return { adapter, call }
}

async function boot(...controllers: Function[]) {
  const { adapter, call } = capturingAdapter()
  const app = new Moost()
  app.adapter(adapter)
  app.registerControllers(...controllers)
  await app.init()
  return { app, call }
}

describe('class interceptors (@Interceptor)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('a singleton interceptor is resolved once per target: later events stay synchronous', async () => {
    const seen: number[] = []
    let constructed = 0

    @Interceptor()
    class CountingGuard {
      constructor() {
        constructed++
      }

      @Before()
      check() {
        seen.push(constructed)
      }
    }

    @Controller()
    class Ctrl {
      @FakeGet('a')
      @Intercept(CountingGuard)
      a() {
        return 'a'
      }
    }

    const { call } = await boot(Ctrl)
    const getSpy = vi.spyOn(getMoostInfact(), 'get')
    expect(await call('/a')).toBe('a')
    const second = call('/a')
    expect(isThenable(second)).toBe(false) // no DI resolution any more
    expect(second).toBe('a')
    expect(call('/a')).toBe('a')
    expect(getSpy.mock.calls.filter(([c]) => c === CountingGuard)).toHaveLength(1)
    expect(constructed).toBe(1)
    expect(seen).toEqual([1, 1, 1]) // the hook still runs on every event
  })

  it('a FOR_EVENT interceptor gets a fresh instance per event', async () => {
    const ids: number[] = []

    @Interceptor(undefined, 'FOR_EVENT')
    class PerEventGuard {
      readonly id = Math.random()

      @Before()
      check() {
        ids.push(this.id)
      }
    }

    @Controller()
    class Ctrl {
      @FakeGet('a')
      @Intercept(PerEventGuard)
      a() {
        return 'a'
      }
    }

    const { call } = await boot(Ctrl)
    await call('/a')
    await call('/a')
    expect(ids).toHaveLength(2)
    expect(ids[0]).not.toBe(ids[1])
  })

  it('a singleton interceptor guarding a FOR_EVENT controller: one instance, every event guarded', async () => {
    const guardIds = new Set<number>()
    let checks = 0

    @Interceptor()
    class SharedGuard {
      readonly id = Math.random()

      @Before()
      check() {
        guardIds.add(this.id)
        checks++
      }
    }

    @Injectable('FOR_EVENT')
    @Controller()
    class PerEventCtrl {
      readonly id = Math.random()

      @FakeGet('a')
      @Intercept(SharedGuard)
      a() {
        return this.id
      }
    }

    const { call } = await boot(PerEventCtrl)
    const first = await call('/a')
    const second = await call('/a')
    expect(first).not.toBe(second)
    expect(checks).toBe(2)
    expect(guardIds.size).toBe(1)
  })

  it('a replace registry swapping in a FOR_EVENT interceptor is not cached', async () => {
    const ids: number[] = []

    @Interceptor()
    class DeclaredGuard {
      @Before()
      check() {}
    }

    @Interceptor(undefined, 'FOR_EVENT')
    class ReplacementGuard {
      readonly id = Math.random()

      @Before()
      check() {
        ids.push(this.id)
      }
    }

    @Controller()
    class Ctrl {
      @FakeGet('a')
      @Intercept(DeclaredGuard)
      a() {
        return 'a'
      }
    }

    const { adapter, call } = capturingAdapter()
    const app = new Moost()
    app.adapter(adapter)
    app.setReplaceRegistry(createReplaceRegistry([DeclaredGuard, ReplacementGuard]))
    app.registerControllers(Ctrl)
    await app.init()
    await call('/a')
    await call('/a')
    expect(ids).toHaveLength(2)
    expect(ids[0]).not.toBe(ids[1])
  })

  it('a failed interceptor resolution is not cached: the next event retries', async () => {
    let attempts = 0

    @Interceptor()
    class FlakyGuard {
      constructor() {
        attempts++
        if (attempts === 1) {
          throw new Error('first boot fails')
        }
      }

      @Before()
      check() {}
    }

    @Controller()
    class Ctrl {
      @FakeGet('a')
      @Intercept(FlakyGuard)
      a() {
        return 'a'
      }
    }

    const { call } = await boot(Ctrl)
    await expect(call('/a')).rejects.toThrow('first boot fails')
    expect(await call('/a')).toBe('a')
    expect(attempts).toBe(2)
  })

  it('a re-init (a new app over the same classes) resolves the interceptor again', async () => {
    let constructed = 0

    @Interceptor()
    class Guard {
      constructor() {
        constructed++
      }

      @Before()
      check() {}
    }

    @Controller()
    class Ctrl {
      @FakeGet('a')
      @Intercept(Guard)
      a() {
        return 'a'
      }
    }

    const first = await boot(Ctrl)
    await first.call('/a')
    getMoostInfact()._cleanup() // what a dev-server reload does before booting again
    const second = await boot(Ctrl)
    await second.call('/a')
    expect(constructed).toBe(2)
  })

  it("the interceptor class' own pipes reach its constructor DI", async () => {
    const upper = (v: unknown) => (typeof v === 'string' ? v.toUpperCase() : v)
    const seen: string[] = []

    @Interceptor()
    @Pipe(upper)
    class PipedGuard {
      constructor(@Const('abc') private readonly v: string) {}

      @Before()
      check() {
        seen.push(this.v)
      }
    }

    @Controller()
    class Ctrl {
      @FakeGet('a')
      @Intercept(PipedGuard)
      a() {
        return 'a'
      }
    }

    const { call } = await boot(Ctrl)
    await call('/a')
    expect(seen).toEqual(['ABC'])
  })
})

describe('event handler hook options', () => {
  it('derive the topic logger only when a hook reads `logger`', () => {
    const createTopic = vi.fn(() => testLogger)
    const logger = { ...testLogger, createTopic }
    let received: TMoostEventHandlerHookOptions<object> | undefined
    const handler = defineMoostEventHandler({
      loggerTitle: 'topic',
      targetPath: '/x',
      handlerType: 'TEST',
      getIterceptorHandler: () => undefined,
      getControllerInstance: () => ({ run: () => 'ok' }),
      controllerMethod: 'run' as never,
      hooks: {
        init: (opts) => {
          received = opts
        },
      },
    })
    expect(createEventContext({ logger }, handler)).toBe('ok')
    expect(createTopic).not.toHaveBeenCalled()
    // destructurable members keep working
    const { scopeId, unscope, getResponse, reply } = received!
    expect(typeof scopeId).toBe('string')
    expect(typeof unscope).toBe('function')
    expect(getResponse()).toBe('ok')
    reply('replaced')
    expect(getResponse()).toBe('replaced')
    expect(received!.logger).toBe(testLogger)
    expect(received!.logger).toBe(testLogger) // derived once
    expect(createTopic).toHaveBeenCalledTimes(1)
    expect(createTopic).toHaveBeenCalledWith('topic')
  })
})

describe('controller context', () => {
  it('reports instance, method, route and prefix; a later set without prefix keeps it', () => {
    class A {}
    class B {}
    const a = new A()
    const b = new B()
    createEventContext({ logger: testLogger }, () => {
      setControllerContext(a, 'm' as never, '/a/m', { prefix: '/a' })
      const cc = useControllerContext()
      expect(cc.getController()).toBe(a)
      expect(cc.getMethod()).toBe('m')
      expect(cc.getRoute()).toBe('/a/m')
      expect(cc.getPrefix()).toBe('/a')

      setControllerContext(b, 'n' as never, '/b/n')
      expect(cc.getController()).toBe(b)
      expect(cc.getPrefix()).toBe('/a')

      // a child without a prefix reports the parent's
      withControllerContext(a, 'm', () => {
        expect(useControllerContext().getPrefix()).toBe('/a')
        expect(useControllerContext().getRoute()).toBe('')
      })
      expect(cc.getController()).toBe(b)
    })
  })

  it('throws the "not set" error of the read field without a controller context', () => {
    createEventContext({ logger: testLogger }, () => {
      const cc = useControllerContext()
      expect(() => cc.getController()).toThrow('Key "controller.instance" is not set')
      expect(() => cc.getMethod()).toThrow('Key "controller.method" is not set')
      expect(() => cc.getRoute()).toThrow('Key "controller.route" is not set')
      expect(() => cc.getPrefix()).toThrow('Key "controller.prefix" is not set')
      setControllerContext({}, '' as never, '/x')
      expect(() => cc.getPrefix()).toThrow('Key "controller.prefix" is not set')
    })
  })
})
