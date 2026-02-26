// oxlint-disable require-await
import {
  ContextInjector,
  createEventContext,
  replaceContextInjector,
  resetContextInjector,
} from '@wooksjs/event-core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { TInterceptorDef } from './decorators'
import type { TInterceptorDefFactory } from './decorators/interceptor.decorator'
import { defineMoostEventHandler } from './adapter-utils'
import { InterceptorHandler } from './interceptor-handler'
import { getMoostInfact } from './metadata/infact'

const testLogger = { info() {}, warn() {}, error() {}, debug() {} }

interface TCiCall {
  name: string
  attributes?: Record<string, string | number | boolean>
}

interface THookCall {
  method: string
  name: string
}

function createSpyCi() {
  const spyCi = Object.assign(new ContextInjector<string>(), {
    withCalls: [] as TCiCall[],
    hookCalls: [] as THookCall[],
  })
  spyCi.with = function <T>(name: string, ...args: unknown[]): T {
    if (typeof args[0] === 'function') {
      this.withCalls.push({ name })
      return (args[0] as () => T)()
    }
    this.withCalls.push({
      name,
      attributes: args[0] as Record<string, string | number | boolean>,
    })
    return (args[1] as () => T)()
  }
  spyCi.hook = function (method: string, name: string) {
    this.hookCalls.push({ method, name })
  }
  return spyCi
}

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

  describe('CI instrumentation', () => {
    let spyCi: ReturnType<typeof createSpyCi>

    beforeEach(() => {
      spyCi = createSpyCi()
      replaceContextInjector(spyCi as unknown as ContextInjector<string>)
    })

    afterEach(() => {
      resetContextInjector()
      vi.restoreAllMocks()
    })

    it('must fire all CI stages for static interceptor with before, after, args, and handler', async () => {
      const beforeFn = vi.fn()
      const afterFn = vi.fn()
      const def: TInterceptorDef = { before: beforeFn, after: afterFn }

      const instance = {
        myMethod(...args: unknown[]) {
          return `result:${args.join(',')}`
        },
      }

      const handler = defineMoostEventHandler({
        loggerTitle: 'test',
        targetPath: '/test/path',
        handlerType: 'HTTP',
        controllerMethod: 'myMethod' as keyof typeof instance,
        controllerName: 'TestCtrl',
        getControllerInstance: () => instance,
        getIterceptorHandler: () =>
          new InterceptorHandler([
            { handler: def, name: 'Guard', spanName: 'Interceptor:Guard' },
          ]),
        resolveArgs: () => ['a', 'b'],
      })

      const result = await createEventContext({ logger: testLogger }, handler)

      expect(result).toBe('result:a,b')
      expect(beforeFn).toHaveBeenCalledOnce()
      expect(afterFn).toHaveBeenCalledOnce()

      expect(spyCi.hookCalls).toEqual([
        { method: 'HTTP', name: 'Controller:registered' },
      ])

      expect(spyCi.withCalls).toEqual([
        { name: 'Interceptors:before' },
        { name: 'Interceptor:Guard', attributes: { 'moost.interceptor.stage': 'before' } },
        { name: 'Arguments:resolve' },
        {
          name: 'Handler:/test/path',
          attributes: { 'moost.handler': 'myMethod', 'moost.controller': 'TestCtrl' },
        },
        { name: 'Interceptors:after' },
        { name: 'Interceptor:Guard', attributes: { 'moost.interceptor.stage': 'after' } },
      ])
    })

    it('must fire factory init + before spans for class-based interceptor with arg resolution', async () => {
      const interceptorBeforeArgs = vi.fn(() => ['resolved-arg'])
      const beforeLogic = vi.fn()
      const interceptorAfterArgs = vi.fn(() => ['after-arg'])
      const afterLogic = vi.fn()

      // Simulates a class-based interceptor: factory creates instance, resolves args for methods
      const factory: TInterceptorDefFactory = () => ({
        before: () => {
          const args = interceptorBeforeArgs()
          beforeLogic(...args)
        },
        after: (response) => {
          const args = interceptorAfterArgs()
          afterLogic(...args, response)
        },
      })

      const instance = { handle: () => 'ok' }

      const handler = defineMoostEventHandler({
        loggerTitle: 'test',
        targetPath: '/class-int',
        handlerType: 'HTTP',
        controllerMethod: 'handle' as keyof typeof instance,
        controllerName: 'Ctrl',
        getControllerInstance: () => instance,
        getIterceptorHandler: () =>
          new InterceptorHandler([
            { handler: factory, name: 'ClassInt', spanName: 'Interceptor:ClassInt' },
          ]),
        resolveArgs: () => [],
      })

      const result = await createEventContext({ logger: testLogger }, handler)

      expect(result).toBe('ok')

      // Interceptor arg resolvers must have been called
      expect(interceptorBeforeArgs).toHaveBeenCalledOnce()
      expect(beforeLogic).toHaveBeenCalledWith('resolved-arg')
      expect(interceptorAfterArgs).toHaveBeenCalledOnce()
      expect(afterLogic).toHaveBeenCalledWith('after-arg', 'ok')

      expect(spyCi.withCalls).toEqual([
        { name: 'Interceptors:before' },
        // def.before call (arg resolution + logic happens inside)
        { name: 'Interceptor:ClassInt', attributes: { 'moost.interceptor.stage': 'before' } },
        { name: 'Arguments:resolve' },
        {
          name: 'Handler:/class-int',
          attributes: { 'moost.handler': 'handle', 'moost.controller': 'Ctrl' },
        },
        { name: 'Interceptors:after' },
        // def.after call (arg resolution + logic happens inside)
        { name: 'Interceptor:ClassInt', attributes: { 'moost.interceptor.stage': 'after' } },
      ])
    })

    it('must fire onError interceptor stage when handler throws', async () => {
      const afterFn = vi.fn()
      const onErrorArgs = vi.fn(() => ['err-context'])
      const onErrorLogic = vi.fn()
      const def: TInterceptorDef = {
        before: vi.fn(),
        after: afterFn,
        error: (error, _reply) => {
          const args = onErrorArgs()
          onErrorLogic(error, ...args)
        },
      }

      const handlerError = new Error('handler failed')
      const instance = {
        fail() {
          throw handlerError
        },
      }

      const handler = defineMoostEventHandler({
        loggerTitle: 'test',
        targetPath: '/fail',
        handlerType: 'HTTP',
        controllerMethod: 'fail' as keyof typeof instance,
        controllerName: 'Ctrl',
        getControllerInstance: () => instance,
        getIterceptorHandler: () =>
          new InterceptorHandler([
            { handler: def, name: 'ErrorInt', spanName: 'Interceptor:ErrorInt' },
          ]),
        resolveArgs: () => [],
      })

      expect(() => createEventContext({ logger: testLogger }, handler)).toThrow('handler failed')

      // after must NOT fire, onError must fire
      expect(afterFn).not.toHaveBeenCalled()
      expect(onErrorArgs).toHaveBeenCalledOnce()
      expect(onErrorLogic).toHaveBeenCalledWith(handlerError, 'err-context')

      expect(spyCi.withCalls).toEqual([
        { name: 'Interceptors:before' },
        { name: 'Interceptor:ErrorInt', attributes: { 'moost.interceptor.stage': 'before' } },
        { name: 'Arguments:resolve' },
        {
          name: 'Handler:/fail',
          attributes: { 'moost.handler': 'fail', 'moost.controller': 'Ctrl' },
        },
        { name: 'Interceptors:after' },
        { name: 'Interceptor:ErrorInt', attributes: { 'moost.interceptor.stage': 'onError' } },
      ])
    })

    it('must fire factory + onError for class-based interceptor when handler throws', async () => {
      const errorArgs = vi.fn(() => ['error-ctx'])
      const errorLogic = vi.fn()

      const factory: TInterceptorDefFactory = () => ({
        error: (error) => {
          const args = errorArgs()
          errorLogic(error, ...args)
        },
      })

      const handlerError = new Error('boom')
      const instance = {
        boom() {
          throw handlerError
        },
      }

      const handler = defineMoostEventHandler({
        loggerTitle: 'test',
        targetPath: '/boom',
        handlerType: 'HTTP',
        controllerMethod: 'boom' as keyof typeof instance,
        controllerName: 'Ctrl',
        getControllerInstance: () => instance,
        getIterceptorHandler: () =>
          new InterceptorHandler([
            { handler: factory, name: 'ClassErr', spanName: 'Interceptor:ClassErr' },
          ]),
      })

      expect(() => createEventContext({ logger: testLogger }, handler)).toThrow('boom')

      expect(errorArgs).toHaveBeenCalledOnce()
      expect(errorLogic).toHaveBeenCalledWith(handlerError, 'error-ctx')

      expect(spyCi.withCalls).toEqual([
        { name: 'Interceptors:before' },
        {
          name: 'Handler:/boom',
          attributes: { 'moost.handler': 'boom', 'moost.controller': 'Ctrl' },
        },
        { name: 'Interceptors:after' },
        { name: 'Interceptor:ClassErr', attributes: { 'moost.interceptor.stage': 'onError' } },
      ])
    })

    it('must work correctly without CI (null injector)', async () => {
      resetContextInjector()

      const beforeFn = vi.fn()
      const afterFn = vi.fn()
      const def: TInterceptorDef = { before: beforeFn, after: afterFn }

      const instance = {
        myMethod() {
          return 'result'
        },
      }

      const handler = defineMoostEventHandler({
        loggerTitle: 'test',
        targetPath: '/test',
        handlerType: 'HTTP',
        controllerMethod: 'myMethod' as keyof typeof instance,
        controllerName: 'Ctrl',
        getControllerInstance: () => instance,
        getIterceptorHandler: () =>
          new InterceptorHandler([
            { handler: def, name: 'Guard', spanName: 'Interceptor:Guard' },
          ]),
        resolveArgs: () => ['arg1'],
      })

      const result = await createEventContext({ logger: testLogger }, handler)

      expect(result).toBe('result')
      expect(beforeFn).toHaveBeenCalledOnce()
      expect(afterFn).toHaveBeenCalledOnce()
    })
  })
})
