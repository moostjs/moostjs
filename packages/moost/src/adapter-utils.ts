import { useEventContext, useEventId, useEventLogger } from '@wooksjs/event-core'
import { InterceptorHandler } from './interceptor-handler'
import { getMoostInfact } from './metadata'
import { setControllerContext } from './composables'

export interface TMoostEventHandlerHookOptions<T> {
    restoreCtx: () => void
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
}

const infact = getMoostInfact()
export function registerEventScope(scopeId: string) {
    infact.registerScope(scopeId)
    return () => infact.unregisterScope(scopeId)
}

export function defineMoostEventHandler<T>(options: TMoostEventHandlerOptions<T>) {
    return async () => {
        const { restoreCtx } = useEventContext(options.contextType)
        const scopeId = useEventId().getId()
        const logger = useEventLogger(options.loggerTitle)
        const unscope = registerEventScope(scopeId)

        let response: unknown
        const hookOptions: TMoostEventHandlerHookOptions<T> = {
            restoreCtx,
            scopeId,
            logger,
            unscope,
            method: options.controllerMethod,
            getResponse: () => response,
            reply: (r: unknown) => response = r,
        }

        if (options.hooks?.init) {
            await options.hooks.init(hookOptions)
            restoreCtx()
        }

        const instance = await options.getControllerInstance()
        restoreCtx()

        if (instance) {
            setControllerContext(instance, options.controllerMethod || ('' as keyof T))
        }

        const interceptorHandler = await options.getIterceptorHandler()
        if (interceptorHandler) {
            restoreCtx()
            try {
                response = await interceptorHandler.init()
                if (typeof response !== 'undefined') return endWithResponse()
            } catch (e) {
                options.logErrors && logger.error(e)
                response = e
                return endWithResponse(true)
            }
        }

        let args: unknown[] = []
        if (options.resolveArgs) {
            // params
            restoreCtx()
            try {
                // logger.trace(`resolving method args for "${ opts.method as string }"`)
                args = await options.resolveArgs()
                // logger.trace(`args for method "${ opts.method as string }" resolved (count ${String(args.length)})`)
            } catch (e) {
                options.logErrors && logger.error(e)
                response = e
                return endWithResponse(true)
            }
        }

        if (interceptorHandler) {
            restoreCtx()
            response = await interceptorHandler.fireBefore(response)
            if (typeof response !== 'undefined') return endWithResponse()
        }

        // fire request handler
        const callControllerMethod = () => {
            restoreCtx()
            if (options.callControllerMethod) {
                return options.callControllerMethod(args)
            } else if (instance && options.controllerMethod && typeof instance[options.controllerMethod] === 'function') {
                return (instance[options.controllerMethod] as unknown as (
                    ...a: typeof args
                ) => unknown
                )(...args)
            }
        }
        try {
            response = callControllerMethod()
        } catch (e) {
            options.logErrors && logger.error(e)
            response = e
            return endWithResponse(true)
        }

        async function endWithResponse(raise = false) {
            // fire after interceptors
            if (interceptorHandler) {
                restoreCtx()
                try {
                    // logger.trace('firing after interceptors')
                    response = await interceptorHandler.fireAfter(response)
                } catch (e) {
                    options.logErrors && logger.error(e)
                    if (!options.manualUnscope) { unscope() }
                    throw e
                }
            }

            if (!options.manualUnscope) { unscope() }
            if (options.hooks?.end) {
                await options.hooks.end(hookOptions)
            }
            if (raise) {
                throw response
            }
            return response
        }
        return await endWithResponse()
    }
}
