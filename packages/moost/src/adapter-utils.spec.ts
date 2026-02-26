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
    it('must call unscope when getControllerInstance throws', () => {
      const unregisterSpy = vi.spyOn(infact, 'unregisterScope')

      const handler = defineMoostEventHandler({
        loggerTitle: 'test',
        targetPath: '/test',
        handlerType: 'HTTP',
        getIterceptorHandler: () => undefined,
        getControllerInstance: () => {
          throw new Error('controller instantiation failed')
        },
      })

      expect(() => createEventContext({ logger: testLogger }, handler)).toThrow(
        'controller instantiation failed',
      )

      expect(unregisterSpy).toHaveBeenCalled()
    })

    it('must call unscope when getIterceptorHandler throws', () => {
      const unregisterSpy = vi.spyOn(infact, 'unregisterScope')

      const handler = defineMoostEventHandler({
        loggerTitle: 'test',
        targetPath: '/test',
        handlerType: 'HTTP',
        getIterceptorHandler: () => {
          throw new Error('interceptor handler failed')
        },
        getControllerInstance: () => ({}),
      })

      expect(() => createEventContext({ logger: testLogger }, handler)).toThrow(
        'interceptor handler failed',
      )

      expect(unregisterSpy).toHaveBeenCalled()
    })

    it('must call unscope when hooks.init throws', () => {
      const unregisterSpy = vi.spyOn(infact, 'unregisterScope')

      const handler = defineMoostEventHandler({
        loggerTitle: 'test',
        targetPath: '/test',
        handlerType: 'HTTP',
        getIterceptorHandler: () => undefined,
        getControllerInstance: () => ({}),
        hooks: {
          init: () => {
            throw new Error('hook init failed')
          },
        },
      })

      expect(() => createEventContext({ logger: testLogger }, handler)).toThrow(
        'hook init failed',
      )

      expect(unregisterSpy).toHaveBeenCalled()
    })

    it('must not call unscope when manualUnscope is true', () => {
      const unregisterSpy = vi.spyOn(infact, 'unregisterScope')

      const handler = defineMoostEventHandler({
        loggerTitle: 'test',
        targetPath: '/test',
        handlerType: 'HTTP',
        manualUnscope: true,
        getIterceptorHandler: () => undefined,
        getControllerInstance: () => {
          throw new Error('controller instantiation failed')
        },
      })

      expect(() => createEventContext({ logger: testLogger }, handler)).toThrow(
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
    it('must propagate error thrown during interceptor init (manualUnscope)', () => {
      const guardError = new Error('Invalid JWT token (CLASS)')
      ;(guardError as { statusCode?: number }).statusCode = 401

      // Factory that throws during init
      const throwingFactory = () => {
        throw guardError
      }

      const handler = defineMoostEventHandler({
        loggerTitle: 'test',
        targetPath: '/test',
        handlerType: 'HTTP',
        manualUnscope: true,
        getIterceptorHandler: () =>
          new InterceptorHandler([{ handler: throwingFactory, name: 'JwtGuard' }]),
        getControllerInstance: () => ({ myMethod: () => 'ok' }),
        controllerMethod: 'myMethod' as never,
      })

      expect(() => createEventContext({ logger: testLogger }, handler)).toThrow(guardError)
    })

    it('must propagate error thrown during interceptor init (auto unscope)', () => {
      const unregisterSpy = vi.spyOn(infact, 'unregisterScope')
      const guardError = new Error('Forbidden')

      // Factory that throws during init
      const throwingFactory = () => {
        throw guardError
      }

      const handler = defineMoostEventHandler({
        loggerTitle: 'test',
        targetPath: '/test',
        handlerType: 'HTTP',
        getIterceptorHandler: () =>
          new InterceptorHandler([{ handler: throwingFactory, name: 'Guard' }]),
        getControllerInstance: () => ({ myMethod: () => 'ok' }),
        controllerMethod: 'myMethod' as never,
      })

      expect(() => createEventContext({ logger: testLogger }, handler)).toThrow('Forbidden')

      expect(unregisterSpy).toHaveBeenCalled()
    })

    it('must propagate interceptor init error with onError handlers registered', () => {
      const guardError = new Error('Unauthorized')
      const onErrorSpy = vi.fn()

      // First interceptor registers an onError handler via TInterceptorDef
      const firstDef = { error: onErrorSpy }

      // Second interceptor (factory) throws during init
      const throwingFactory = () => {
        throw guardError
      }

      const handler = defineMoostEventHandler({
        loggerTitle: 'test',
        targetPath: '/test',
        handlerType: 'HTTP',
        manualUnscope: true,
        getIterceptorHandler: () =>
          new InterceptorHandler([
            { handler: firstDef, name: 'LogInterceptor' },
            { handler: throwingFactory, name: 'JwtGuard' },
          ]),
        getControllerInstance: () => ({ myMethod: () => 'ok' }),
        controllerMethod: 'myMethod' as never,
      })

      expect(() => createEventContext({ logger: testLogger }, handler)).toThrow('Unauthorized')

      // the onError handler from the first interceptor should have been called
      expect(onErrorSpy).toHaveBeenCalledWith(guardError, expect.any(Function))
    })
  })
})
