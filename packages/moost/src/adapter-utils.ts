// oxlint-disable complexity
import type { Logger } from '@wooksjs/event-core'
import { current, defineWook, getContextInjector, useLogger } from '@wooksjs/event-core'

import { setControllerContext } from './composables'
import type { InterceptorHandler } from './interceptor-handler'
import { getMoostInfact } from './metadata'
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
  handlerType: string
}

// Monotonic scope ID counter — avoids randomUUID() crypto overhead.
// On overflow, increment alphabetic prefix and reset counter.
let _scopeChar = 'a'
let _scopeNum = 0
function nextScopeId(): string {
  if (_scopeNum >= Number.MAX_SAFE_INTEGER) {
    _scopeNum = 0
    _scopeChar =
      _scopeChar === 'z' ? 'a' : String.fromCodePoint((_scopeChar.codePointAt(0) ?? 97) + 1)
  }
  return `__moost_${_scopeChar}_${++_scopeNum}`
}

/** Composable returning the moost scope ID for the current event. Generates on first call, caches for subsequent calls. */
export const useScopeId = defineWook(() => nextScopeId())

/** Registers a DI scope for the given ID and returns an unscope function. */
export function registerEventScope(scopeId: string) {
  const infact = getMoostInfact()
  infact.registerScope(scopeId)
  return () => {
    infact.unregisterScope(scopeId)
  }
}

/**
 * Creates the complete event handler lifecycle processor used by adapters.
 * Handles scope registration, controller resolution, interceptors, argument resolution,
 * handler invocation, and cleanup — optimised for sync-first execution.
 */
export function defineMoostEventHandler<T>(options: TMoostEventHandlerOptions<T>) {
  const ci = getContextInjector<TContextInjectorHook>()
  // Pre-compute strings used in ci.with() to avoid per-request template literal creation
  const handlerSpanName = `Handler:${options.targetPath}` as 'Handler'
  const handlerAttrs = {
    'moost.handler': (options.controllerMethod as string) || '',
    'moost.controller': options.controllerName || '',
  }

  return () => {
    const ctx = current()
    const scopeId = useScopeId(ctx)
    const ctxLogger = useLogger(ctx)
    const logger =
      typeof ctxLogger.topic === 'function' ? ctxLogger.topic(options.loggerTitle) : ctxLogger
    const unscope = registerEventScope(scopeId)

    let response: unknown
    // Lazy hookOptions — only allocated when hooks actually need them
    let hookOptions: TMoostEventHandlerHookOptions<T> | undefined

    function getHookOptions(): TMoostEventHandlerHookOptions<T> {
      return (hookOptions ??= {
        scopeId,
        logger,
        unscope,
        method: options.controllerMethod,
        getResponse: () => response,
        reply: (r: unknown) => (response = r),
      })
    }

    let interceptorHandler: InterceptorHandler | undefined
    let raise = false

    try {
      if (options.hooks?.init) {
        const hookResult = options.hooks.init(getHookOptions())
        if (isThenable(hookResult)) {
          return (hookResult as PromiseLike<unknown>).then(afterInit)
        }
      }
      return afterInit()
    } catch (error) {
      if (!options.manualUnscope) {
        unscope()
      }
      throw error
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
            logger.error(String(error))
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
            logger.error(String(error))
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
        : instance && options.controllerMethod && typeof instance[options.controllerMethod] === 'function'
          ? () => (instance[options.controllerMethod as keyof T] as unknown as (...a: unknown[]) => unknown)(...args)
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
                logger.error(error as string)
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
          logger.error(error as string)
        }
        response = error
        raise = true
      }

      return cleanup()
    }

    function handleError(error: unknown): unknown {
      if (options.logErrors) {
        logger.error(String(error))
      }
      response = error
      raise = true
      return cleanup()
    }

    // cleanup runs after interceptors, unscopes, runs hooks, then returns or throws.
    function cleanup(): unknown {
      // fire after interceptors
      if (interceptorHandler?.countAfter || interceptorHandler?.countOnError) {
        const afterResult = ci
          ? ci.with('Interceptors:after', () => interceptorHandler?.fireAfter(response))
          : interceptorHandler?.fireAfter(response)
        if (isThenable(afterResult)) {
          return (afterResult as PromiseLike<unknown>).then(
            (r) => {
              response = r
              return finalize()
            },
            (error: unknown) => {
              if (options.logErrors) {
                logger.error(String(error))
              }
              if (!options.manualUnscope) {
                unscope()
              }
              throw error
            },
          )
        }
        response = afterResult
      }

      return finalize()
    }

    function finalize(): unknown {
      if (!options.manualUnscope) {
        unscope()
      }
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
