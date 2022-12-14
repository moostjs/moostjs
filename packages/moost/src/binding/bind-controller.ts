import { useHttpContext } from '@wooksjs/event-http'
import { getMoostMate, TMoostMetadata, TMoostParamsMetadata } from '../metadata'
import { TPipeData } from '../pipes'
import { TAny, TClassConstructor, TObject } from '../types'
import { getInstanceOwnMethods } from './utils'
import { TInterceptorFn } from '../decorators'
import { getCallableFn } from '../class-function/class-function'
import { log } from 'common/log'
import { InterceptorHandler, TMoostAdapter } from '../adapter'
import { runPipes } from '../pipes/run-pipes'
import { useEventContext } from '@wooksjs/event-core'
import { getMoostInfact } from '../metadata/infact'

export interface TBindControllerOptions {
    getInstance: () => Promise<TObject>
    classConstructor: TClassConstructor
    adapters: TMoostAdapter<TAny>[]
    globalPrefix?: string
    replaceOwnPrefix?: string
    provide?: TMoostMetadata['provide']
    interceptors?: TMoostMetadata['interceptors']
    pipes?: TPipeData[]
}

export async function bindControllerMethods(options: TBindControllerOptions) {
    const opts = options || {}
    const { getInstance } = opts
    const { classConstructor } = opts
    const { adapters } = opts
    opts.globalPrefix = opts.globalPrefix || ''
    opts.provide = opts.provide || {}
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    const fakeInstance = Object.create(classConstructor.prototype) as TObject
    const methods = getInstanceOwnMethods(fakeInstance)
    const mate = getMoostMate()
    const meta = mate.read(classConstructor) || {} as TMoostMetadata
    const ownPrefix = typeof opts.replaceOwnPrefix === 'string' ? opts.replaceOwnPrefix : (meta.controller?.prefix || '')
    const prefix = `${opts.globalPrefix}/${ ownPrefix }`
    for (const method of methods) {
        const methodMeta = getMoostMate().read(fakeInstance, method) || {} as TMoostMetadata
        if (!methodMeta.handlers || !methodMeta.handlers.length) continue

        // preparing interceptors
        const interceptors = [...(opts.interceptors || []), ...(meta.interceptors || []), ...(methodMeta.interceptors || [])].sort((a, b) => a.priority - b.priority)
        const getIterceptorHandler = async () => {
            const interceptorHandlers: TInterceptorFn[] = []
            for (const { handler } of interceptors) {
                const interceptorMeta = mate.read(handler)
                if (interceptorMeta?.injectable) {
                    interceptorHandlers.push(async (...args) => {
                        const { restoreCtx } = useHttpContext()
                        const targetInstance = await getInstance()
                        restoreCtx()
                        return (await getCallableFn(targetInstance, handler, restoreCtx))(...args)
                    })
                } else {
                    interceptorHandlers.push(handler as TInterceptorFn)
                }
            }
            return new InterceptorHandler(interceptorHandlers)
        }

        // preparing pipes
        const pipes = [...(opts.pipes || []), ...(meta.pipes || []), ...(methodMeta.pipes || [])]
        const argsPipes: {
            meta: TMoostParamsMetadata
            pipes: TPipeData[]
        }[] = []
        for (const p of methodMeta.params || []) {
            argsPipes.push({
                meta: p,
                pipes: [...pipes, ...(p.pipes || [])].sort((a, b) => a.priority - b.priority),
            })
        }

        const resolveArgs = async () => {
            const args: unknown[] = []
            const { restoreCtx } = useEventContext()
            for (let i = 0; i < argsPipes.length; i++) {
                const { pipes, meta } = argsPipes[i]
                args[i] = await runPipes(pipes, meta, restoreCtx)
            }
            return args           
        }

        // preparing provide
        // const provide = {...(opts.provide || {}), ...(meta.provide || {})}

        for (const adapter of adapters) {
            await adapter.bindHandler({
                prefix,
                fakeInstance,
                getInstance,
                registerEventScope: (scopeId: string) => {
                    const infact = getMoostInfact()
                    infact.registerScope(scopeId)
                    return () => infact.unregisterScope(scopeId)
                },
                method,
                handlers: methodMeta.handlers,
                getIterceptorHandler,
                resolveArgs,
                logHandler: (eventName: string) => log(`??? ${eventName} ${__DYE_RESET__ + __DYE_DIM__ + __DYE_GREEN__}??? ${classConstructor.name}.${__DYE_CYAN__}${method as string}${__DYE_GREEN__}()`),
            })
        }
    }
}
