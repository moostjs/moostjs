// oxlint-disable complexity
import type { Logger } from '@wooksjs/event-core'
import { current, getContextInjector, useLogger } from '@wooksjs/event-core'

import { setControllerContext } from './composables'
import type { TEventScope } from './event-scope'
import { getEventScope, holdEventScopeLazily } from './event-scope'
import type { InterceptorHandler } from './interceptor-handler'
import { isThenable } from './shared-utils'
import type { TContextInjectorHook } from './types'

/** Options passed to init/end hooks during the event handler lifecycle. */
export interface TMoostEventHandlerHookOptions<T> {
  scopeId: string
  logger: Logger
  unscope: () => void
  instance?: T
  method?: keyof T
  getResponse: () => unknown
  reply: (r: unknown) => void
}

/** Configuration for `defineMoostEventHandler`, describing how to resolve and invoke a handler. */
export interface TMoostEventHandlerOptions<T> {
  /** @deprecated unused since wooks v0.7 — the event kind comes from the wooks adapter */
  contextType?: string | string[]
  loggerTitle: string
  getIterceptorHandler: () => InterceptorHandler | undefined
  getControllerInstance: () => Promise<T> | T | undefined
  controllerMethod?: keyof T
  controllerName?: string
  callControllerMethod?: (args: unknown[]) => unknown
  resolveArgs?: () => Promise<unknown[]> | unknown[]
  logErrors?: boolean
  manualUnscope?: boolean
  hooks?: {
    init?: (opts: TMoostEventHandlerHookOptions<T>) => unknown
    end?: (opts: TMoostEventHandlerHookOptions<T>) => unknown
  }
  targetPath: string
  controllerPrefix?: string
  handlerType: string
}

const noop = () => {}

/**
 * The hook options of one event. `logger` is a prototype getter: the topic logger is only
 * derived when a hook reads it (an own accessor property would deopt the object instead).
 */
class EventHookOptions<T> implements TMoostEventHandlerHookOptions<T> {
  declare scopeId: string
  declare unscope: () => void
  declare method?: keyof T
  declare getResponse: () => unknown
  declare reply: (r: unknown) => void
  declare instance?: T
  declare protected _getLogger: () => Logger

  // oxlint-disable-next-line max-params -- internal, built once per event
  constructor(
    scopeId: string,
    unscope: () => void,
    method: keyof T | undefined,
    getResponse: () => unknown,
    reply: (r: unknown) => void,
    getLogger: () => Logger,
  ) {
    this.scopeId = scopeId
    this.unscope = unscope
    this.method = method
    this.getResponse = getResponse
    this.reply = reply
    this._getLogger = getLogger
  }

  get logger(): Logger {
    return this._getLogger()
  }
}

/**
 * Holds an event's DI scope (registered on demand, see `holdEventScopeLazily`) by its handler
 * lifecycle and, with `adapterHolds`, by the adapter too. Each release is idempotent; the
 * scope is dropped once every holder let go, so an adapter signal that fires early (a client
 * disconnect mid-handler) cannot pull the scope from under a running handler. Built outside
 * the handler closure so a long-lived adapter listener (the response 'close' of a streamed
 * body) retains only the scope.
 */
function holdEventScope(scope: TEventScope, adapterHolds: boolean) {
  const drop = holdEventScopeLazily(scope)
  let holders = adapterHolds ? 2 : 1
  const hold = () => {
    let held = true
    return () => {
      if (held) {
        held = false
        if (--holders === 0) {
          drop()
        }
      }
    }
  }
  const releaseLifecycle = hold()
  return {
    releaseLifecycle,
    failLifecycle: (error: unknown): never => {
      releaseLifecycle()
      throw error
    },
    unscope: adapterHolds ? hold() : noop,
  }
}

/**
 * Creates the complete event handler lifecycle processor used by adapters.
 * Handles scope registration, controller resolution, interceptors, argument resolution,
 * handler invocation, and cleanup — optimised for sync-first execution.
 */
export function defineMoostEventHandler<T>(options: TMoostEventHandlerOptions<T>) {
  const manualUnscope = !!options.manualUnscope
  // Pre-compute strings used in ci.with() to avoid per-request template literal creation
  const handlerSpanName = `Handler:${options.targetPath}` as 'Handler'
  const handlerAttrs = {
    'moost.handler': (options.controllerMethod as string) || '',
    'moost.controller': options.controllerName || '',
  }

  return () => {
    // read per event: a context injector replaced after init() applies to bound handlers too
    const ci = getContextInjector<TContextInjectorHook>()
    const ctx = current()
    const scope = getEventScope(ctx)
    const scopeId = scope.id
    const { unscope, releaseLifecycle, failLifecycle } = holdEventScope(scope, manualUnscope)

    let response: unknown
    // Lazy logger — derived only when an error is logged or a hook reads it
    let logger: Logger | undefined
    // useLogger(topic, ctx) derives a child logger via createTopic when supported,
    // falling back to the base logger otherwise
    const getLogger = () => (logger ??= useLogger(options.loggerTitle, ctx))
    // Lazy hookOptions — only allocated when hooks actually need them
    let hookOptions: TMoostEventHandlerHookOptions<T> | undefined

    function getHookOptions(): TMoostEventHandlerHookOptions<T> {
      return (hookOptions ??= new EventHookOptions<T>(
        scopeId,
        unscope,
        options.controllerMethod,
        () => response,
        (r: unknown) => (response = r),
        getLogger,
      ))
    }

    let interceptorHandler: InterceptorHandler | undefined
    let raise = false

    // One guard releases the lifecycle hold on any failure, sync or from any async step
    // (release is idempotent, so paths that already released pass straight through).
    try {
      const result = start()
      return isThenable(result)
        ? (result as PromiseLike<unknown>).then(undefined, failLifecycle)
        : result
    } catch (error) {
      return failLifecycle(error)
    }

    function start(): unknown {
      if (options.hooks?.init) {
        const hookResult = options.hooks.init(getHookOptions())
        if (isThenable(hookResult)) {
          return (hookResult as PromiseLike<unknown>).then(afterInit)
        }
      }
      return afterInit()
    }

    function afterInit(): unknown {
      const instanceResult = options.getControllerInstance()
      if (isThenable(instanceResult)) {
        return (instanceResult as PromiseLike<unknown>).then((inst) =>
          afterInstance(inst as T | undefined),
        )
      }
      return afterInstance(instanceResult as T | undefined)
    }

    function afterInstance(instance: T | undefined): unknown {
      if (instance) {
        setControllerContext(
          instance,
          options.controllerMethod || ('' as keyof T),
          options.targetPath,
          {
            prefix: options.controllerPrefix,
          },
        )
        ci?.hook(options.handlerType, 'Controller:registered' as 'Handler:routed')
      }

      interceptorHandler = options.getIterceptorHandler() as InterceptorHandler | undefined
      if (interceptorHandler?.count) {
        try {
          const initResult = ci
            ? ci.with('Interceptors:before', () => interceptorHandler?.before())
            : interceptorHandler?.before()
          if (isThenable(initResult)) {
            return (initResult as PromiseLike<unknown>).then((r) => {
              response = r
              if (response !== undefined) {
                return cleanup()
              }
              return afterInterceptors(instance)
            }, handleError)
          }
          response = initResult
          if (response !== undefined) {
            return cleanup()
          }
        } catch (error) {
          if (options.logErrors) {
            getLogger().error(String(error))
          }
          response = error
          raise = true
          return cleanup()
        }
      }

      return afterInterceptors(instance)
    }

    function afterInterceptors(instance: T | undefined): unknown {
      let args: unknown[] = []
      if (options.resolveArgs) {
        try {
          const argsResult = ci
            ? ci.with('Arguments:resolve', () => options.resolveArgs?.())
            : options.resolveArgs?.()
          if (isThenable(argsResult)) {
            return (argsResult as PromiseLike<unknown>).then((a) => {
              args = a as unknown[]
              return callHandler(instance, args)
            }, handleError)
          }
          args = argsResult as unknown[]
        } catch (error) {
          if (options.logErrors) {
            getLogger().error(String(error))
          }
          response = error
          raise = true
          return cleanup()
        }
      }

      return callHandler(instance, args)
    }

    function callHandler(instance: T | undefined, args: unknown[]): unknown {
      const invoke = options.callControllerMethod
        ? () => options.callControllerMethod?.(args)
        : instance &&
            options.controllerMethod &&
            typeof instance[options.controllerMethod] === 'function'
          ? () =>
              (
                instance[options.controllerMethod as keyof T] as unknown as (
                  ...a: unknown[]
                ) => unknown
              )(...args)
          : undefined
      try {
        const handlerResult = ci
          ? ci.with(handlerSpanName, handlerAttrs, () => invoke?.())
          : invoke?.()
        if (isThenable(handlerResult)) {
          return (handlerResult as PromiseLike<unknown>).then(
            (r) => {
              response = r
              return cleanup()
            },
            (error: unknown) => {
              if (options.logErrors) {
                getLogger().error(error as string)
              }
              response = error
              raise = true
              return cleanup()
            },
          )
        }
        response = handlerResult
      } catch (error) {
        if (options.logErrors) {
          getLogger().error(error as string)
        }
        response = error
        raise = true
      }

      return cleanup()
    }

    function handleError(error: unknown): unknown {
      if (options.logErrors) {
        getLogger().error(String(error))
      }
      response = error
      raise = true
      return cleanup()
    }

    // cleanup runs after interceptors, unscopes, runs hooks, then returns or throws.
    function cleanup(): unknown {
      // fire after interceptors
      if (interceptorHandler?.countAfter || interceptorHandler?.countOnError) {
        // remember the raised error so we can detect recovery via reply() in onError phase
        const raisedResponse = response
        const afterResult = ci
          ? ci.with('Interceptors:after', () => interceptorHandler?.fireAfter(response))
          : interceptorHandler?.fireAfter(response)
        if (isThenable(afterResult)) {
          return (afterResult as PromiseLike<unknown>).then(
            (r) => {
              response = r
              if (raise && response !== raisedResponse) {
                // an error interceptor recovered via reply() — return a clean response
                raise = false
              }
              return finalize()
            },
            (error: unknown) => {
              if (options.logErrors) {
                getLogger().error(String(error))
              }
              throw error
            },
          )
        }
        response = afterResult
        if (raise && response !== raisedResponse) {
          // an error interceptor recovered via reply() — return a clean response
          raise = false
        }
      }

      return finalize()
    }

    function finalize(): unknown {
      releaseLifecycle()
      if (options.hooks?.end) {
        const endResult = options.hooks.end(getHookOptions())
        if (isThenable(endResult)) {
          return (endResult as PromiseLike<unknown>).then(() => {
            if (raise) {
              // oxlint-disable-next-line no-throw-literal it is an Error instance
              throw response as Error
            }
            return response
          })
        }
      }
      if (raise) {
        // oxlint-disable-next-line no-throw-literal it is an Error instance
        throw response as Error
      }
      return response
    }
  }
}
