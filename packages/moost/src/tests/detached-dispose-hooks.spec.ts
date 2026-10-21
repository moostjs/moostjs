// oxlint-disable max-classes-per-file -- one isolated controller per test case
import {
  ContextInjector,
  createEventContext,
  current,
  eventTypeKey,
  replaceContextInjector,
  resetContextInjector,
} from '@wooksjs/event-core'
import { describe, expect, it, vi } from 'vitest'

import { useControllerContext } from '../composables'
import { Controller } from '../decorators/controller.decorator'
import { MoostDispose } from '../decorators/dispose.decorator'
import { Injectable } from '../decorators/injectable.decorator'
import { useScopeId } from '../event-scope'
import type { TMoostAdapter } from '../moost'
import { detachedKind, Moost } from '../moost'
import { scopes } from './fake-route.artifacts'

@Injectable('FOR_EVENT')
class PerRun {
  readonly id = Math.random()
}

describe('Moost.runDetached()', () => {
  it('runs in a fresh root event with its own DI scope, released when it settles', async () => {
    const app = new Moost()
    await app.init()
    const before = scopes().size
    let callerScope = ''
    let detachedScope = ''
    let parent: unknown = 'unset'
    let instances: number[] = []

    const run = createEventContext({ logger: console }, () => {
      callerScope = useScopeId()
      return app.runDetached('send-mail', async () => {
        detachedScope = useScopeId()
        parent = current().parent
        const a = await useControllerContext().instantiate(PerRun)
        const b = await useControllerContext().instantiate(PerRun)
        instances = [a.id, b.id]
        expect(scopes().has(detachedScope)).toBe(true)
        return current().get(eventTypeKey)
      })
    })

    expect(await run).toBe(detachedKind.name)
    expect(parent).toBeUndefined() // not a child of the calling event
    expect(detachedScope).not.toBe(callerScope)
    expect(instances[0]).toBe(instances[1]) // one FOR_EVENT instance per run
    expect(scopes().has(detachedScope)).toBe(false)
    expect(scopes().size).toBe(before)
  })

  it('logs a failure and resolves undefined instead of rejecting', async () => {
    const error = vi.fn()
    const logger = { log() {}, info() {}, warn() {}, error, debug() {} }
    const app = new Moost()
    await app.init()
    const before = scopes().size

    const result = await app.runDetached(
      'failing-job',
      async () => {
        await useControllerContext().instantiate(PerRun)
        throw new Error('job failed')
      },
      { logger },
    )

    expect(result).toBeUndefined()
    expect(error).toHaveBeenCalledWith(expect.stringContaining('failing-job'), expect.any(Error))
    expect(scopes().size).toBe(before)
  })
})

describe('Moost.runDetached() — instrumentation and shutdown', () => {
  it('names the event after the run for context injectors (OpenTelemetry span name)', async () => {
    const hooks: unknown[][] = []
    const spy = new ContextInjector<string>()
    spy.hook = (...args: unknown[]) => void hooks.push(args)
    replaceContextInjector(spy)
    try {
      const app = new Moost()
      await app.init()
      await app.runDetached('send-mail', () => 'sent')
    } finally {
      resetContextInjector()
    }
    expect(hooks).toEqual([
      ['DETACHED', 'Handler:routed', 'send-mail'],
      ['DETACHED', 'Controller:registered'],
    ])
  })

  it('dispose() waits for detached runs in flight before running the instance hooks', async () => {
    const log: string[] = []

    @Controller('detached-dispose')
    class Owner {
      @MoostDispose()
      close() {
        log.push('Owner.close')
      }
    }

    const app = new Moost()
    app.registerControllers(Owner)
    await app.init()
    void app.runDetached('slow-job', async () => {
      await new Promise((resolve) => setTimeout(resolve, 30))
      log.push('job done')
    })
    await app.dispose()

    expect(log).toEqual(['job done', 'Owner.close'])
  })
})

describe('Moost.addDisposeHook()', () => {
  it('runs after the adapters stop, ordered with @MoostDispose hooks by priority', async () => {
    const log: string[] = []

    @Controller('dispose-hooks')
    class Owner {
      @MoostDispose({ priority: 10 })
      close() {
        log.push('Owner.close(10)')
      }
    }

    const adapter: TMoostAdapter<unknown> = {
      name: 'fake',
      bindHandler() {},
      onDispose() {
        log.push('adapter.onDispose')
      },
    }

    const app = new Moost()
    app.adapter(adapter)
    app.registerControllers(Owner)
    app.addDisposeHook(() => void log.push('hook(0)'))
    app.addDisposeHook((a) => void log.push(`hook(20) app=${a === app}`), { priority: 20 })
    app.addDisposeHook(() => void log.push('hook(5)'), { priority: 5 })
    await app.init()
    await app.dispose()

    expect(log).toEqual([
      'adapter.onDispose',
      'hook(0)',
      'hook(5)',
      'Owner.close(10)',
      'hook(20) app=true',
    ])
  })

  it('does not run a hook registered after dispose() was called', async () => {
    const log: string[] = []
    const app = new Moost()
    app.adapter({
      name: 'slow-intake',
      bindHandler() {},
      async onDispose() {
        await new Promise((resolve) => setTimeout(resolve, 10))
      },
    })
    app.addDisposeHook(() => void log.push('registered before'))
    await app.init()

    const disposing = app.dispose()
    app.addDisposeHook(() => void log.push('registered after'))
    await disposing

    expect(log).toEqual(['registered before'])
  })

  it('collects a failing hook in the AggregateError after running the rest', async () => {
    const log: string[] = []
    const app = new Moost()
    app.addDisposeHook(function stopSweeper() {
      throw new Error('sweeper stuck')
    })
    app.addDisposeHook(() => void log.push('after'), { priority: 1 })
    await app.init()

    const failure = await app.dispose().catch((error: unknown) => error)

    expect(failure).toBeInstanceOf(AggregateError)
    expect((failure as AggregateError).message).toContain('stopSweeper')
    expect(log).toEqual(['after'])
  })
})
