import { createAsyncEventContext } from '@wooksjs/event-core'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { defineMoostEventHandler } from './adapter-utils'
import { getMoostInfact } from './metadata/infact'

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

      await expect(
        createAsyncEventContext({
          event: { type: 'test' },
          options: {},
        })(handler),
      ).rejects.toThrow('controller instantiation failed')

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

      await expect(
        createAsyncEventContext({
          event: { type: 'test' },
          options: {},
        })(handler),
      ).rejects.toThrow('interceptor handler failed')

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

      await expect(
        createAsyncEventContext({
          event: { type: 'test' },
          options: {},
        })(handler),
      ).rejects.toThrow('hook init failed')

      expect(unregisterSpy).toHaveBeenCalled()
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

      const result = await createAsyncEventContext({
        event: { type: 'test' },
        options: {},
      })(handler)

      expect(result).toBe('ok')
      expect(unregisterSpy).toHaveBeenCalled()
    })
  })
})
