import { ContextInjector, replaceContextInjector } from '@wooksjs/event-core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { TInterceptorFn } from './decorators'
import { InterceptorHandler } from './interceptor-handler'

describe('InterceptorHandler', () => {
  describe('fireAfter', () => {
    let spyCi: ContextInjector<string> & {
      calls: { name: string; attributes?: Record<string, string | number | boolean> }[]
    }
    let originalCi: ContextInjector<string>

    beforeEach(() => {
      originalCi = new ContextInjector()
      spyCi = Object.assign(new ContextInjector<string>(), {
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
      replaceContextInjector(spyCi as unknown as ContextInjector<string>)
    })

    afterEach(() => {
      replaceContextInjector(originalCi)
    })

    it('must use stage "onError" when response is an Error', async () => {
      const onErrorFn = vi.fn()
      const afterFn = vi.fn()

      const initFn: TInterceptorFn = (_before, after, onError) => {
        after(afterFn)
        onError(onErrorFn)
      }

      const handler = new InterceptorHandler([{ handler: initFn, name: 'test' }])
      await handler.init()

      const error = new Error('test error')
      spyCi.calls = [] // reset after init
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

      const initFn: TInterceptorFn = (_before, after, onError) => {
        after(afterFn)
        onError(onErrorFn)
      }

      const handler = new InterceptorHandler([{ handler: initFn, name: 'test' }])
      await handler.init()

      spyCi.calls = [] // reset after init
      await handler.fireAfter('success')

      expect(afterFn).toHaveBeenCalledOnce()
      expect(onErrorFn).not.toHaveBeenCalled()

      const stages = spyCi.calls
        .filter((c) => c.attributes?.['moost.interceptor.stage'])
        .map((c) => c.attributes!['moost.interceptor.stage'])
      expect(stages).toEqual(['after'])
    })
  })

  describe('init', () => {
    it('must call all interceptor handlers in order', async () => {
      const order: number[] = []
      const fn1: TInterceptorFn = () => {
        order.push(1)
      }
      const fn2: TInterceptorFn = () => {
        order.push(2)
      }

      const handler = new InterceptorHandler([
        { handler: fn1, name: 'first' },
        { handler: fn2, name: 'second' },
      ])
      await handler.init()

      expect(order).toEqual([1, 2])
    })

    it('must short-circuit when an interceptor returns a value', async () => {
      const fn1: TInterceptorFn = () => 'early-response'
      const fn2: TInterceptorFn = vi.fn()

      const handler = new InterceptorHandler([
        { handler: fn1, name: 'first' },
        { handler: fn2, name: 'second' },
      ])
      const response = await handler.init()

      expect(response).toBe('early-response')
      expect(fn2).not.toHaveBeenCalled()
    })
  })

  describe('fireBefore', () => {
    it('must short-circuit when reply is called', async () => {
      const beforeFn1 = vi.fn((reply: (r: unknown) => void) => {
        reply('intercepted')
      })
      const beforeFn2 = vi.fn()

      const initFn: TInterceptorFn = (before) => {
        before(beforeFn1)
        before(beforeFn2)
      }

      const handler = new InterceptorHandler([{ handler: initFn, name: 'test' }])
      await handler.init()

      const response = await handler.fireBefore(undefined)

      expect(response).toBe('intercepted')
      expect(beforeFn1).toHaveBeenCalledOnce()
      expect(beforeFn2).not.toHaveBeenCalled()
    })
  })
})
