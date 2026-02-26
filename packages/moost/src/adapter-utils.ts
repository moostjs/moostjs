// oxlint-disable complexity
import { getConstructor } from '@prostojs/mate'
import type { Logger } from '@wooksjs/event-core'
import { current, getContextInjector, useEventId, useLogger } from '@wooksjs/event-core'

import { setControllerContext } from './composables'
import type { InterceptorHandler } from './interceptor-handler'
import { getMoostInfact } from './metadata'
import type { TContextInjectorHook } from './types'

export interface TMoostEventHandlerHookOptions<T> {
  scopeId: string
  logger: Logger
  unscope: () => void
  instance?: T
  method?: keyof T
  getResponse: () => unknown
  reply: (r: unknown) => void
}

export interface TMoostEventHandlerOptions<T> {
  contextType?: string | string[]
  loggerTitle: string
  getIterceptorHandler: () => InterceptorHandler | undefined
  getControllerInstance: () => Promise<T> | T | undefined
  controllerMethod?: keyof T
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

function isThenable(value: unknown): value is PromiseLike<unknown> {
  return (
    value !== null &&
    value !== undefined &&
    typeof (value as PromiseLike<unknown>).then === 'function'
  )
}

const infact = getMoostInfact()
export function registerEventScope(scopeId: string) {
  infact.registerScope(scopeId)
  return () => {
    infact.unregisterScope(scopeId)
  }
}

export function defineMoostEventHandler<T>(options: TMoostEventHandlerOptions<T>) {
  const ci = getContextInjector<TContextInjectorHook>()
  return async () => {
    const ctx = current()
    const scopeId = useEventId(ctx).getId()
    const ctxLogger = useLogger(ctx)
    const logger =
      typeof ctxLogger.topic === 'function' ? ctxLogger.topic(options.loggerTitle) : ctxLogger
    const unscope = registerEventScope(scopeId)

    let response: unknown
    const hookOptions: TMoostEventHandlerHookOptions<T> = {
      scopeId,
      logger,
      unscope,
      method: options.controllerMethod,
      getResponse: () => response,
      reply: (r: unknown) => (response = r),
    }

    let interceptorHandler: InterceptorHandler | undefined
    let raise = false

    try {
      if (options.hooks?.init) {
        const hookResult = options.hooks.init(hookOptions)
        if (isThenable(hookResult)) {
          await hookResult
        }
      }

      const instanceResult = options.getControllerInstance()
      const instance = isThenable(instanceResult) ? await instanceResult : instanceResult

      if (instance) {
        setControllerContext(
          instance,
          options.controllerMethod || ('' as keyof T),
          options.targetPath,
        )
        ci.hook(options.handlerType, 'Controller:registered' as 'Handler:routed')
      }

      interceptorHandler = options.getIterceptorHandler() as InterceptorHandler | undefined
      if (interceptorHandler?.count) {
        try {
          const initResult = ci.with('Interceptors:init', () => interceptorHandler?.init())
          response = isThenable(initResult) ? await initResult : initResult
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

      let args: unknown[] = []
      if (options.resolveArgs) {
        // params
        try {
          const argsResult = ci.with('Arguments:resolve', () => options.resolveArgs?.())
          args = (isThenable(argsResult) ? await argsResult : argsResult) as unknown[]
        } catch (error) {
          if (options.logErrors) {
            logger.error(String(error))
          }
          response = error
          raise = true
          return cleanup()
        }
      }

      if (interceptorHandler?.countBefore) {
        const beforeResult = ci.with('Interceptors:before', () =>
          interceptorHandler?.fireBefore(response),
        )
        response = isThenable(beforeResult) ? await beforeResult : beforeResult
        if (response !== undefined) {
          return cleanup()
        }
      }

      // fire request handler
      const callControllerMethod = () => {
        if (options.callControllerMethod) {
          return options.callControllerMethod(args)
        } else if (
          instance &&
          options.controllerMethod &&
          typeof instance[options.controllerMethod] === 'function'
        ) {
          return (instance[options.controllerMethod] as unknown as (...a: typeof args) => unknown)(
            ...args,
          )
        }
      }
      try {
        const handlerResult = ci.with(
          `Handler:${options.targetPath}` as 'Handler',
          {
            'moost.handler': (options.controllerMethod as string) || '',
            'moost.controller': getConstructor(instance).name,
          },
          () => callControllerMethod(),
        )
        response = isThenable(handlerResult) ? await handlerResult : handlerResult
      } catch (error) {
        if (options.logErrors) {
          logger.error(error as string)
        }
        response = error
        raise = true
      }

      return cleanup()
    } catch (error) {
      if (!options.manualUnscope) {
        unscope()
      }
      throw error
    }

    // cleanup runs after interceptors, unscopes, runs hooks, then returns or throws.
    // It NEVER throws synchronously — uses Promise rejection for async raise.
    function cleanup(): unknown {
      // fire after interceptors
      if (interceptorHandler?.countAfter || interceptorHandler?.countOnError) {
        const afterResult = ci.with('Interceptors:after', () =>
          interceptorHandler?.fireAfter(response),
        )
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
        const endResult = options.hooks.end(hookOptions)
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
        return Promise.reject(response)
      }
      return response
    }
  }
}
