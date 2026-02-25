import { createEventContext } from '@wooksjs/event-core'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { defineMoostEventHandler } from './adapter-utils'
import { InterceptorHandler } from './interceptor-handler'
import { getMoostInfact } from './metadata/infact'

const testLogger = { info() {}, warn() {}, error() {}, debug() {} }

describe('defineMoostEventHandler', () => {
  const infact = getMoostInfact()

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('scope cleanup', () => {
    it('must call unscope when getControllerInstance throws', async () => {
      const unregisterSpy = vi.spyOn(infact, 'unregisterScope')
      const error = new Error('controller instantiation failed')

      const handler = defineMoostEventHandler({
        loggerTitle: 'test',
        targetPath: '/test',
        handlerType: 'HTTP',
        getIterceptorHandler: () => undefined,
        getControllerInstance: () => {
          throw error
        },
      })

      await expect(createEventContext({ logger: testLogger }, handler)).rejects.toThrow(
        'controller instantiation failed',
      )

      expect(unregisterSpy).toHaveBeenCalled()
    })

    it('must call unscope when getIterceptorHandler throws', async () => {
      const unregisterSpy = vi.spyOn(infact, 'unregisterScope')
      const error = new Error('interceptor handler failed')

      const handler = defineMoostEventHandler({
        loggerTitle: 'test',
        targetPath: '/test',
        handlerType: 'HTTP',
        getIterceptorHandler: () => {
          throw error
        },
        getControllerInstance: () => ({}),
      })

      await expect(createEventContext({ logger: testLogger }, handler)).rejects.toThrow(
        'interceptor handler failed',
      )

      expect(unregisterSpy).toHaveBeenCalled()
    })

    it('must call unscope when hooks.init throws', async () => {
      const unregisterSpy = vi.spyOn(infact, 'unregisterScope')
      const error = new Error('hook init failed')

      const handler = defineMoostEventHandler({
        loggerTitle: 'test',
        targetPath: '/test',
        handlerType: 'HTTP',
        getIterceptorHandler: () => undefined,
        getControllerInstance: () => ({}),
        hooks: {
          init: () => {
            throw error
          },
        },
      })

      await expect(createEventContext({ logger: testLogger }, handler)).rejects.toThrow(
        'hook init failed',
      )

      expect(unregisterSpy).toHaveBeenCalled()
    })

    it('must not call unscope when manualUnscope is true', async () => {
      const unregisterSpy = vi.spyOn(infact, 'unregisterScope')
      const error = new Error('controller instantiation failed')

      const handler = defineMoostEventHandler({
        loggerTitle: 'test',
        targetPath: '/test',
        handlerType: 'HTTP',
        manualUnscope: true,
        getIterceptorHandler: () => undefined,
        getControllerInstance: () => {
          throw error
        },
      })

      await expect(createEventContext({ logger: testLogger }, handler)).rejects.toThrow(
        'controller instantiation failed',
      )

      // with manualUnscope, the outer catch should not call unscope
      expect(unregisterSpy).not.toHaveBeenCalled()
    })

    it('must call unscope on successful handler execution', async () => {
      const unregisterSpy = vi.spyOn(infact, 'unregisterScope')

      const instance = {
        myMethod() {
          return 'ok'
        },
      }

      const handler = defineMoostEventHandler({
        loggerTitle: 'test',
        targetPath: '/test',
        handlerType: 'HTTP',
        getIterceptorHandler: () => undefined,
        getControllerInstance: () => instance,
        controllerMethod: 'myMethod' as keyof typeof instance,
      })

      const result = await createEventContext({ logger: testLogger }, handler)

      expect(result).toBe('ok')
      expect(unregisterSpy).toHaveBeenCalled()
    })
  })

  describe('interceptor error propagation', () => {
    it('must propagate error thrown during interceptor init (manualUnscope)', async () => {
      const guardError = new Error('Invalid JWT token (CLASS)')
      ;(guardError as { statusCode?: number }).statusCode = 401

      const throwingHandler = (_before: unknown, _after: unknown, _onError: unknown) => {
        throw guardError
      }

      const handler = defineMoostEventHandler({
        loggerTitle: 'test',
        targetPath: '/test',
        handlerType: 'HTTP',
        manualUnscope: true,
        getIterceptorHandler: () =>
          new InterceptorHandler([{ handler: throwingHandler, name: 'JwtGuard' }]),
        getControllerInstance: () => ({ myMethod: () => 'ok' }),
        controllerMethod: 'myMethod' as never,
      })

      const resultPromise = createEventContext({ logger: testLogger }, handler)

      await expect(resultPromise).rejects.toThrow('Invalid JWT token (CLASS)')
      await expect(resultPromise).rejects.toBe(guardError)
    })

    it('must propagate error thrown during interceptor init (auto unscope)', async () => {
      const unregisterSpy = vi.spyOn(infact, 'unregisterScope')
      const guardError = new Error('Forbidden')

      const throwingHandler = () => {
        throw guardError
      }

      const handler = defineMoostEventHandler({
        loggerTitle: 'test',
        targetPath: '/test',
        handlerType: 'HTTP',
        getIterceptorHandler: () =>
          new InterceptorHandler([{ handler: throwingHandler, name: 'Guard' }]),
        getControllerInstance: () => ({ myMethod: () => 'ok' }),
        controllerMethod: 'myMethod' as never,
      })

      await expect(createEventContext({ logger: testLogger }, handler)).rejects.toThrow('Forbidden')

      expect(unregisterSpy).toHaveBeenCalled()
    })

    it('must propagate interceptor init error with onError handlers registered', async () => {
      const guardError = new Error('Unauthorized')
      const onErrorSpy = vi.fn()

      const firstInterceptor = (
        _before: unknown,
        _after: unknown,
        onError: (fn: (error: Error, reply: (r: unknown) => void) => void) => void,
      ) => {
        onError(onErrorSpy)
      }

      const throwingGuard = () => {
        throw guardError
      }

      const handler = defineMoostEventHandler({
        loggerTitle: 'test',
        targetPath: '/test',
        handlerType: 'HTTP',
        manualUnscope: true,
        getIterceptorHandler: () =>
          new InterceptorHandler([
            { handler: firstInterceptor, name: 'LogInterceptor' },
            { handler: throwingGuard, name: 'JwtGuard' },
          ]),
        getControllerInstance: () => ({ myMethod: () => 'ok' }),
        controllerMethod: 'myMethod' as never,
      })

      await expect(createEventContext({ logger: testLogger }, handler)).rejects.toThrow(
        'Unauthorized',
      )

      // the onError handler from the first interceptor should have been called
      expect(onErrorSpy).toHaveBeenCalledWith(guardError, expect.any(Function))
    })
  })
})
