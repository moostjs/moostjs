import { ContextInjector, replaceContextInjector } from '@wooksjs/event-core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { TInterceptorDef } from './decorators'
import type { TInterceptorDefFactory } from './decorators/interceptor.decorator'
import { InterceptorHandler } from './interceptor-handler'

function createSpyCi() {
  const spyCi = Object.assign(new ContextInjector<string>(), {
    calls: [] as { name: string; attributes?: Record<string, string | number | boolean> }[],
  })
  spyCi.with = function <T>(name: string, ...args: unknown[]): T {
    if (typeof args[0] === 'function') {
      this.calls.push({ name })
      return (args[0] as () => T)()
    }
    this.calls.push({
      name,
      attributes: args[0] as Record<string, string | number | boolean>,
    })
    return (args[1] as () => T)()
  }
  return spyCi
}

describe('InterceptorHandler', () => {
  describe('fireAfter', () => {
    let spyCi: ReturnType<typeof createSpyCi>
    let originalCi: ContextInjector<string>

    beforeEach(() => {
      originalCi = new ContextInjector()
      spyCi = createSpyCi()
      replaceContextInjector(spyCi as unknown as ContextInjector<string>)
    })

    afterEach(() => {
      replaceContextInjector(originalCi)
    })

    it('must use stage "onError" when response is an Error', async () => {
      const onErrorFn = vi.fn()
      const afterFn = vi.fn()
      const def: TInterceptorDef = { after: afterFn, error: onErrorFn }

      const handler = new InterceptorHandler([{ handler: def, name: 'test' }])
      await handler.before()

      const error = new Error('test error')
      spyCi.calls = []
      await handler.fireAfter(error)

      expect(onErrorFn).toHaveBeenCalledOnce()
      expect(afterFn).not.toHaveBeenCalled()

      const stages = spyCi.calls
        .filter((c) => c.attributes?.['moost.interceptor.stage'])
        .map((c) => c.attributes!['moost.interceptor.stage'])
      expect(stages).toEqual(['onError'])
    })

    it('must use stage "after" when response is not an Error', async () => {
      const onErrorFn = vi.fn()
      const afterFn = vi.fn()
      const def: TInterceptorDef = { after: afterFn, error: onErrorFn }

      const handler = new InterceptorHandler([{ handler: def, name: 'test' }])
      await handler.before()

      spyCi.calls = []
      await handler.fireAfter('success')

      expect(afterFn).toHaveBeenCalledOnce()
      expect(onErrorFn).not.toHaveBeenCalled()

      const stages = spyCi.calls
        .filter((c) => c.attributes?.['moost.interceptor.stage'])
        .map((c) => c.attributes!['moost.interceptor.stage'])
      expect(stages).toEqual(['after'])
    })
  })

  describe('before with factory (TInterceptorDefFactory)', () => {
    it('must call factory and register returned def hooks', async () => {
      const order: number[] = []
      const factory1: TInterceptorDefFactory = () => {
        order.push(1)
        return { after: vi.fn() }
      }
      const factory2: TInterceptorDefFactory = () => {
        order.push(2)
        return { after: vi.fn() }
      }

      const handler = new InterceptorHandler([
        { handler: factory1, name: 'first' },
        { handler: factory2, name: 'second' },
      ])
      await handler.before()

      expect(order).toEqual([1, 2])
      expect(handler.countAfter).toBe(2)
    })

    it('must short-circuit when factory before calls reply', async () => {
      const factory: TInterceptorDefFactory = () => ({
        before(reply) {
          reply('early-from-factory')
        },
      })
      const fn2 = vi.fn()

      const handler = new InterceptorHandler([
        { handler: factory, name: 'first' },
        { handler: fn2, name: 'second' },
      ])
      const response = await handler.before()

      expect(response).toBe('early-from-factory')
      expect(fn2).not.toHaveBeenCalled()
    })

    it('must handle async factory', async () => {
      const factory: TInterceptorDefFactory = async () => {
        await Promise.resolve()
        return { after: vi.fn() }
      }

      const handler = new InterceptorHandler([{ handler: factory, name: 'async' }])
      await handler.before()
      expect(handler.countAfter).toBe(1)
    })
  })

  describe('before with static TInterceptorDef', () => {
    it('must register hooks and run before', async () => {
      const def: TInterceptorDef = {
        before: vi.fn(),
        after: vi.fn(),
        error: vi.fn(),
      }

      const handler = new InterceptorHandler([{ handler: def, name: 'static' }])
      await handler.before()

      expect(def.before).toHaveBeenCalledOnce()
      expect(handler.countAfter).toBe(1)
      expect(handler.countOnError).toBe(1)
    })

    it('must short-circuit when before calls reply', async () => {
      const def: TInterceptorDef = {
        before(reply) {
          reply('early')
        },
      }
      const def2: TInterceptorDef = { after: vi.fn() }

      const handler = new InterceptorHandler([
        { handler: def, name: 'first' },
        { handler: def2, name: 'second' },
      ])
      const response = await handler.before()

      expect(response).toBe('early')
      expect(handler.countAfter).toBe(0) // second never registered
    })
  })

  describe('mixed factory and static defs', () => {
    it('must process in correct order', async () => {
      const order: string[] = []

      const factory: TInterceptorDefFactory = () => {
        order.push('factory-init')
        return { after: () => order.push('factory-after') }
      }

      const def: TInterceptorDef = {
        after() {
          order.push('def-after')
        },
      }

      const handler = new InterceptorHandler([
        { handler: factory, name: 'factory' },
        { handler: def, name: 'def' },
      ])
      await handler.before()
      await handler.fireAfter('ok')

      // LIFO order for after hooks: def registered second, fires first
      expect(order).toEqual(['factory-init', 'def-after', 'factory-after'])
    })

    it('must handle async before with reply', async () => {
      const def: TInterceptorDef = {
        async before(reply) {
          await Promise.resolve()
          reply('async-early')
        },
      }

      const handler = new InterceptorHandler([{ handler: def, name: 'asyncBefore' }])
      const response = await handler.before()

      expect(response).toBe('async-early')
    })

    it('must register both after and error from a single def', async () => {
      const afterFn = vi.fn()
      const errorFn = vi.fn()
      const def: TInterceptorDef = { after: afterFn, error: errorFn }

      const handler = new InterceptorHandler([{ handler: def, name: 'both' }])
      await handler.before()

      expect(handler.countAfter).toBe(1)
      expect(handler.countOnError).toBe(1)

      await handler.fireAfter('ok')
      expect(afterFn).toHaveBeenCalledOnce()
      expect(errorFn).not.toHaveBeenCalled()
    })
  })
})
