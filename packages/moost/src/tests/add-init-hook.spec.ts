// oxlint-disable max-classes-per-file -- one isolated controller per test case
import { describe, it, expect } from 'vitest'

import { useControllerContext } from '../composables'
import { Controller } from '../decorators/controller.decorator'
import { InjectMoost, MoostInit } from '../decorators/init.decorator'
import { Injectable } from '../decorators/injectable.decorator'
import { Moost } from '../moost'
import { createCaptureLogger } from './capture-logger.artifacts'

describe('Moost.addInitHook', () => {
  it('runs once after bind, sees the complete overview and receives the app', async () => {
    const seen: string[][] = []
    const apps: Moost[] = []

    @Controller('a')
    class A {}

    @Controller('b')
    class B {}

    const app = new Moost()
    app.addInitHook((m) => {
      apps.push(m)
      seen.push(m.getControllersOverview().map((c) => c.type.name))
    })
    app.registerControllers(A, B)
    await app.init()

    expect(seen).toHaveLength(1)
    expect(seen[0]).toContain('A')
    expect(seen[0]).toContain('B')
    expect(apps[0]).toBe(app)
  })

  it('shares ordering with @MoostInit: priority, then registration order', async () => {
    const log: string[] = []

    @Controller('a')
    class A {
      @MoostInit(0)
      init() {
        log.push('decorator-0')
      }
    }

    const app = new Moost()
    app.addInitHook(() => log.push('fn-1'), { priority: 1 })
    app.addInitHook(() => log.push('fn-0-first'))
    app.addInitHook(() => log.push('fn--1'), { priority: -1 })
    app.addInitHook(() => log.push('fn-0-second'), { priority: 0 })
    app.registerControllers(A)
    await app.init()

    // programmatic hooks were registered before the decorator hook (added at bind)
    expect(log).toEqual(['fn--1', 'fn-0-first', 'fn-0-second', 'decorator-0', 'fn-1'])
  })

  it('accepts registration from a singleton constructor during bind', async () => {
    const log: string[] = []

    @Controller('first')
    class First {
      @MoostInit(0)
      init() {
        log.push('first-init')
      }
    }

    @Controller('second')
    class Second {
      constructor(app: Moost) {
        app.addInitHook(() => log.push('early'), { priority: -1 })
        app.addInitHook(() => log.push('same-pass'))
      }
    }

    const app = new Moost()
    app.registerControllers(First, Second)
    await app.init()

    expect(log).toEqual(['early', 'first-init', 'same-pass'])
  })

  it('runs a hook registered from inside a running hook later in the same pass', async () => {
    const log: string[] = []
    const app = new Moost()
    app.addInitHook(
      (m) => {
        log.push('outer')
        m.addInitHook(() => log.push('inner'), { priority: 5 })
      },
      { priority: 1 },
    )
    app.addInitHook(() => log.push('between'), { priority: 2 })
    await app.init()

    expect(log).toEqual(['outer', 'between', 'inner'])
  })

  it('runs a hook registered after init immediately, in the app controller context', async () => {
    const app = new Moost()
    await app.init()

    let controller: unknown
    let ran!: () => void
    const done = new Promise<void>((resolve) => (ran = resolve))
    app.addInitHook(() => {
      controller = useControllerContext().getController()
      ran()
    })
    await done

    expect(controller).toBe(app)
  })

  it('logs a failing late hook instead of rejecting', async () => {
    const { logger, errors } = createCaptureLogger()
    const app = new Moost({ logger: logger as never })
    await app.init()

    app.addInitHook(() => {
      throw new Error('late boom')
    })
    await new Promise((resolve) => setTimeout(resolve, 10))

    expect(errors.join('\n')).toContain('late boom')
  })

  it('rejects init() when a hook throws, before or during the pass', async () => {
    const before = new Moost()
    before.addInitHook(() => {
      throw new Error('before boom')
    })
    await expect(before.init()).rejects.toThrow('before boom')

    const during = new Moost()
    during.addInitHook((m) => {
      m.addInitHook(() => {
        throw new Error('during boom')
      })
    })
    await expect(during.init()).rejects.toThrow('during boom')
  })

  it('finishes all init hooks before any adapter onInit', async () => {
    const log: string[] = []
    const app = new Moost()
    app.adapter({
      bindHandler() {},
      onInit() {
        log.push(`adapter:${log.join(',')}`)
      },
    })
    app.addInitHook(() => log.push('a'), { priority: 1 })
    app.addInitHook(() => log.push('b'), { priority: -1 })
    await app.init()

    expect(log).toEqual(['b', 'a', 'adapter:b,a'])
  })

  it('does not de-duplicate the same function', async () => {
    let count = 0
    const fn = () => {
      count++
    }
    const app = new Moost()
    app.addInitHook(fn)
    app.addInitHook(fn)
    await app.init()

    expect(count).toBe(2)
  })

  it('leaves FOR_EVENT controllers unaffected; their late registration runs immediately', async () => {
    let ran!: () => void
    const done = new Promise<void>((resolve) => (ran = resolve))

    @Injectable('FOR_EVENT')
    @Controller('fe')
    class PerEvent {
      constructor(@InjectMoost() app: Moost) {
        app.addInitHook(() => ran())
      }
    }

    const app = new Moost()
    app.registerControllers(PerEvent)
    await app.init() // no bind error

    // simulate the event-time construction
    // eslint-disable-next-line no-new
    new PerEvent(app)
    await done
  })

  it('does not store late hooks: they run once and not again on re-init', async () => {
    let early = 0
    let late = 0
    const app = new Moost()
    app.addInitHook(() => {
      early++
    })
    await app.init()
    const lateHook = () => {
      late++
    }
    for (let i = 0; i < 20; i++) {
      app.addInitHook(lateHook)
    }
    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(late).toBe(20)
    expect((app as unknown as { initHooks: unknown[] }).initHooks).toHaveLength(1)

    await app.init()
    expect(early).toBe(2)
    expect(late).toBe(20)
  })
})
