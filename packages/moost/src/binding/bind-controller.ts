import { Wooks } from 'wooks'
import { useHttpContext } from '@wooksjs/event-http'
import { getMoostMate, TMoostMetadata } from '../metadata'
import { TPipeData } from '../pipes'
import { TClassConstructor, TObject } from '../types'
import { bindHandler } from './bind-handler'
import { getInstanceOwnMethods } from './utils'
import { log } from '../utils/log'
import { TInterceptorFn } from '../decorators'
import { getCallableFn } from '../class-function/class-function'

export interface TBindControllerOptions {
    globalPrefix?: string
    replaceOwnPrefix?: string
    provide?: TMoostMetadata['provide']
    interceptors?: TMoostMetadata['interceptors']
    pipes?: TPipeData[]
}

export function bindControllerMethods(getInstance: () => Promise<TObject>, classConstructor: TClassConstructor, wooksApp: Wooks, options?: TBindControllerOptions) {
    const opts = options || {}
    opts.globalPrefix = opts.globalPrefix || ''
    opts.provide = opts.provide || {}
    const fakeInstance = Object.create(classConstructor.prototype) as TObject
    const methods = getInstanceOwnMethods(fakeInstance)
    const mate = getMoostMate()
    const meta = mate.read(classConstructor) || {} as TMoostMetadata
    const ownPrefix = typeof opts.replaceOwnPrefix === 'string' ? opts.replaceOwnPrefix : (meta.controller?.prefix || '')
    const prefix = `${opts.globalPrefix}/${ ownPrefix }`
    for (const method of methods) {
        const methodMeta = getMoostMate().read(fakeInstance, method) || {} as TMoostMetadata
        if (!methodMeta.httpHandler || !methodMeta.httpHandler.length) continue

        // preparing interceptors
        const interceptors = [...(opts.interceptors || []), ...(meta.interceptors || []), ...(methodMeta.interceptors || [])].sort((a, b) => a.priority - b.priority)
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

        // preparing pipes
        const pipes = [...(opts.pipes || []), ...(meta.pipes || []), ...(methodMeta.pipes || [])]
        const argsPipes = []
        for (const p of methodMeta.params || []) {
            argsPipes.push({
                meta: p,
                pipes: [...pipes, ...(p.pipes || [])].sort((a, b) => a.priority - b.priority),
            })
        }

        // preparing provide
        const provide = {...(opts.provide || {}), ...(meta.provide || {})}
        for (const { method: httpMethod, path: httpPath } of methodMeta.httpHandler) {
            const path = typeof httpPath === 'string' ? httpPath : typeof method === 'string' ? method : ''
            const targetPath = `${prefix || ''}/${path}`.replace(/\/\/+/g, '/')
            bindHandler(getInstance, method, wooksApp, {
                path: targetPath,
                httpMethod,
                interceptorHandlers,
                provide,
                argsMeta: methodMeta.params,
                argsPipes,
            })
            log(`• ${httpMethod}${__DYE_CYAN__} ${targetPath} ${__DYE_GREEN__}→ ${classConstructor.name}.${__DYE_CYAN__}${method as string}${__DYE_GREEN__}()`)
        }
    }
}
