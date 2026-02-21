// oxlint-disable complexity
import { getConstructor } from '@prostojs/mate'
import { getContextInjector, useEventId, useEventLogger } from '@wooksjs/event-core'

import { setControllerContext } from './composables'
import type { InterceptorHandler } from './interceptor-handler'
import { getMoostInfact } from './metadata'
import type { TContextInjectorHook } from './types'

export interface TMoostEventHandlerHookOptions<T> {
  scopeId: string
  logger: ReturnType<typeof useEventLogger>
  unscope: () => void
  instance?: T
  method?: keyof T
  getResponse: () => unknown
  reply: (r: unknown) => void
}

export interface TMoostEventHandlerOptions<T> {
  contextType?: string | string[]
  loggerTitle: string
  getIterceptorHandler: () => Promise<InterceptorHandler> | InterceptorHandler | undefined
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
    const scopeId = useEventId().getId()
    const logger = useEventLogger(options.loggerTitle)
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

    if (options.hooks?.init) {
      await options.hooks.init(hookOptions)
    }

    const instance = await options.getControllerInstance()

    if (instance) {
      setControllerContext(
        instance,
        options.controllerMethod || ('' as keyof T),
        options.targetPath,
      )
      ci.hook(options.handlerType, 'Controller:registered' as 'Handler:routed')
    }

    const interceptorHandler = await options.getIterceptorHandler()
    if (interceptorHandler?.count) {
      try {
        response = await ci.with('Interceptors:init', () => interceptorHandler.init())
        if (response !== undefined) {
          return await endWithResponse()
        }
      } catch (error) {
        if (options.logErrors) {
          logger.error(error)
        }
        response = error
        return endWithResponse(true)
      }
    }

    let args: unknown[] = []
    if (options.resolveArgs) {
      // params
      try {
        // logger.trace(`resolving method args for "${ opts.method as string }"`)
        args = await ci.with('Arguments:resolve', () => options.resolveArgs!())
        // logger.trace(`args for method "${ opts.method as string }" resolved (count ${String(args.length)})`)
      } catch (error) {
        if (options.logErrors) {
          logger.error(error)
        }
        response = error
        return endWithResponse(true)
      }
    }

    if (interceptorHandler?.countBefore) {
      response = await ci.with('Interceptors:before', () => interceptorHandler.fireBefore(response))
      if (response !== undefined) {
        return endWithResponse()
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
      response = await ci.with(
        `Handler:${options.targetPath}` as 'Handler',
        {
          'moost.handler': (options.controllerMethod as string) || '',
          'moost.controller': getConstructor(instance).name,
        },
        () => callControllerMethod(),
      )
    } catch (error) {
      if (options.logErrors) {
        logger.error(error)
      }
      response = error
      return endWithResponse(true)
    }

    async function endWithResponse(raise = false) {
      // fire after interceptors
      if (interceptorHandler?.countAfter || interceptorHandler?.countOnError) {
        try {
          // logger.trace('firing after interceptors')
          response = await ci.with('Interceptors:after', () =>
            interceptorHandler.fireAfter(response),
          )
        } catch (error) {
          if (options.logErrors) {
          logger.error(error)
        }
          if (!options.manualUnscope) {
            unscope()
          }
          throw error
        }
      }

      if (!options.manualUnscope) {
        unscope()
      }
      if (options.hooks?.end) {
        await options.hooks.end(hookOptions)
      }
      if (raise) {
        // oxlint-disable-next-line no-throw-literal it is an Error instance
        throw (response as Error)
      }
      return response
    }
    return endWithResponse()
  }
}
