// oxlint-disable max-classes-per-file, max-lines -- one isolated controller per test case
import { describe, it, expect } from 'vitest'

import { Controller } from '../decorators/controller.decorator'
import { MoostDispose } from '../decorators/dispose.decorator'
import { Injectable } from '../decorators/injectable.decorator'
import { disposeInstances } from '../dispose'
import type { TMoostAdapter } from '../moost'
import { Moost } from '../moost'

/**
 * NOTE: the Infact registry is process-global, so `app.dispose()` disposes every
 * singleton alive in this module — including leftovers from earlier cases. Each
 * case therefore asserts on its OWN closure-scoped log, never on a shared one.
 */
describe('@MoostDispose', () => {
  it('runs the hook of a SINGLETON controller on app.dispose()', async () => {
    const log: string[] = []

    @Controller('a')
    class A {
      @MoostDispose()
      close() {
        log.push('A.close')
      }
    }

    const app = new Moost()
    app.registerControllers(A)
    await app.init()
    await app.dispose()

    expect(log).toEqual(['A.close'])
  })

  it('runs the hook of an @Injectable() singleton dependency', async () => {
    const log: string[] = []

    @Injectable()
    class CacheClient {
      @MoostDispose()
      async quit() {
        await Promise.resolve()
        log.push('cache.quit')
      }
    }

    @Controller('b')
    class B {
      constructor(protected readonly cache: CacheClient) {}
    }

    const app = new Moost()
    app.registerControllers(B)
    await app.init()
    await app.dispose()

    expect(log).toEqual(['cache.quit'])
  })

  it('disposes a controller registered as an object instance', async () => {
    const log: string[] = []

    @Controller('c')
    class C {
      @MoostDispose()
      close() {
        log.push('C.close')
      }
    }

    const app = new Moost()
    app.registerControllers(new C())
    await app.init()
    await app.dispose()

    expect(log).toEqual(['C.close'])
  })

  it('runs hooks in ascending priority across instances', async () => {
    const log: string[] = []

    @Injectable()
    class Db {
      @MoostDispose({ priority: 10 })
      close() {
        log.push('db')
      }
    }

    @Injectable()
    class Consumer {
      @MoostDispose({ priority: -10 })
      drain() {
        log.push('consumer')
      }
    }

    @Controller('ord')
    class Ord {
      constructor(
        protected readonly db: Db,
        protected readonly consumer: Consumer,
      ) {}

      @MoostDispose()
      close() {
        log.push('controller')
      }
    }

    const app = new Moost()
    app.registerControllers(Ord)
    await app.init()
    await app.dispose()

    expect(log).toEqual(['consumer', 'controller', 'db'])
  })

  it.skipIf(typeof Symbol.asyncDispose !== 'symbol')(
    'honors Symbol.asyncDispose without a decorator',
    async () => {
      const log: string[] = []

      @Injectable()
      class Handle {
        async [Symbol.asyncDispose]() {
          await Promise.resolve()
          log.push('asyncDispose')
        }
      }

      @Controller('sym')
      class Sym {
        constructor(protected readonly handle: Handle) {}
      }

      const app = new Moost()
      app.registerControllers(Sym)
      await app.init()
      await app.dispose()

      expect(log).toEqual(['asyncDispose'])
    },
  )

  it.skipIf(typeof Symbol.dispose !== 'symbol')(
    'honors Symbol.dispose without a decorator',
    async () => {
      const log: string[] = []

      @Injectable()
      class SyncHandle {
        [Symbol.dispose]() {
          log.push('dispose')
        }
      }

      @Controller('sym2')
      class Sym2 {
        constructor(protected readonly handle: SyncHandle) {}
      }

      const app = new Moost()
      app.registerControllers(Sym2)
      await app.init()
      await app.dispose()

      expect(log).toEqual(['dispose'])
    },
  )

  it('throws at bind for a FOR_EVENT controller', async () => {
    @Injectable('FOR_EVENT')
    class F {
      @MoostDispose()
      close() {
        /* unreachable */
      }
    }

    const app = new Moost()
    app.registerControllers(F)
    await expect(app.init()).rejects.toThrow(/@MoostDispose is not allowed on a FOR_EVENT/)
  })

  it('runs adapters’ onDispose first, in registration order', async () => {
    const log: string[] = []

    @Controller('ad')
    class Ad {
      @MoostDispose()
      close() {
        log.push('hook')
      }
    }

    const first: TMoostAdapter<unknown> = {
      name: 'first',
      bindHandler() {},
      onDispose() {
        log.push('adapter-first')
      },
    }
    const second: TMoostAdapter<unknown> = {
      name: 'second',
      bindHandler() {},
      async onDispose() {
        await new Promise((resolve) => setTimeout(resolve, 5))
        log.push('adapter-second')
      },
    }

    const app = new Moost()
    app.adapter(first)
    app.adapter(second)
    app.registerControllers(Ad)
    await app.init()
    await app.dispose()

    expect(log).toEqual(['adapter-first', 'adapter-second', 'hook'])
  })

  it('rejects with an AggregateError naming the failing hook, after running the rest', async () => {
    const log: string[] = []

    @Injectable()
    class Broken {
      @MoostDispose({ priority: 0 })
      close() {
        throw new Error('teardown failed')
      }
    }

    @Controller('agg')
    class Agg {
      constructor(protected readonly broken: Broken) {}

      @MoostDispose({ priority: 1 })
      close() {
        log.push('agg')
      }
    }

    const app = new Moost()
    app.registerControllers(Agg)
    await app.init()
    const caught = (await app.dispose().catch((error: unknown) => error)) as AggregateError

    expect(log).toEqual(['agg']) // every hook still ran
    expect(caught).toBeInstanceOf(AggregateError)
    expect(caught.message).toContain('Broken.close (teardown failed)')
  })

  it('collects a throwing adapter onDispose without skipping instance hooks', async () => {
    const log: string[] = []

    @Controller('adErr')
    class AdErr {
      @MoostDispose()
      close() {
        log.push('hook')
      }
    }

    const adapter: TMoostAdapter<unknown> = {
      name: 'boom',
      bindHandler() {},
      onDispose() {
        throw new Error('adapter down')
      },
    }

    const app = new Moost()
    app.adapter(adapter)
    app.registerControllers(AdErr)
    await app.init()
    const caught = (await app.dispose().catch((error: unknown) => error)) as AggregateError

    expect(log).toEqual(['hook'])
    expect(caught.message).toContain('onDispose (adapter down)')
  })

  it('is idempotent: a second dispose() returns the same promise and runs nothing', async () => {
    const log: string[] = []

    @Controller('idem')
    class Idem {
      @MoostDispose()
      close() {
        log.push('close')
      }
    }

    const app = new Moost()
    app.registerControllers(Idem)
    await app.init()
    const first = app.dispose()
    expect(app.dispose()).toBe(first)
    await first
    await app.dispose()

    expect(log).toEqual(['close'])
  })

  it('skips an instance already disposed through disposeInstances()', async () => {
    const log: string[] = []

    @Controller('pre')
    class Pre {
      @MoostDispose()
      close() {
        log.push('close')
      }
    }

    const instance = new Pre()
    const app = new Moost()
    app.registerControllers(instance)
    await app.init()
    await disposeInstances([instance])
    expect(log).toEqual(['close'])

    await app.dispose()
    expect(log).toEqual(['close']) // not run twice
  })

  it('never evaluates getters while scanning a controller for hooks', async () => {
    const log: string[] = []

    @Controller('trap')
    class Trap {
      get exploding(): string {
        throw new Error('getter must not be evaluated')
      }

      @MoostDispose()
      close() {
        log.push('close')
      }
    }

    const app = new Moost()
    app.registerControllers(Trap)
    await app.init()
    await app.dispose()

    expect(log).toEqual(['close'])
  })
})
