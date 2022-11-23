import { useHttpContext, useRequest } from '@wooksjs/event-http'
import { TMoostAdapter, TMoostAdapterOptions } from 'moost'
import { Wooks } from 'wooks'

export interface THttpHandlerMeta {
    method: string
    path: string
}

export class MoostHttp implements TMoostAdapter<THttpHandlerMeta> {
    constructor(protected wooks: Wooks) {}

    bindHandler<T extends object = object>(opts: TMoostAdapterOptions<THttpHandlerMeta, T>): void | Promise<void> {
        let fn
        for (const handler of opts.handlers) {
            if (handler.type !== 'HTTP') continue
            const httpPath = handler.path
            const path = typeof httpPath === 'string' ? httpPath : typeof opts.method === 'string' ? opts.method : ''
            const targetPath = `${opts.prefix || ''}/${path}`.replace(/\/\/+/g, '/')
            if (!fn) {
                fn = async () => {
                    const { restoreCtx } = useHttpContext()
                    const { reqId, rawRequest } = useRequest()
                    const scopeId = reqId()

                    rawRequest.on('end', opts.registerEventScope(scopeId))

                    const instance = await opts.getInstance()
                    restoreCtx()

                    // setComposableControllerContext({
                    //     controller: instance,
                    //     method: method as string,
                    //     pathBuilder: pathBuilder as ReturnType<Wooks['on']>,
                    // })

                    let response: unknown
                    await opts.interceptorHandler.init()

                    // params
                    let args: unknown[] = []
                    try {
                        restoreCtx()
                        args = await opts.resolveArgs()
                    } catch (e) {
                        response = e
                    }

                    if (!response) {
                        restoreCtx()
                        // fire before interceptors
                        response = await opts.interceptorHandler.fireBefore(response)
                        // fire request handler
                        if (!opts.interceptorHandler.responseOverwritten) {
                            try {
                                restoreCtx()
                                response = await (instance[opts.method] as unknown as (...a: typeof args) => unknown)(...args)
                            } catch (e) {
                                response = e
                            }
                        }
                    }

                    // fire after interceptors
                    response = await opts.interceptorHandler.fireAfter(response)
                    return response
                }
            }
            const pathBuilder = this.wooks.on(handler.method, targetPath, fn)
            opts.logHandler(`${__DYE_CYAN__}(${handler.method})${ __DYE_GREEN__ }${ targetPath }`)
        }
    }
}
