import { createHttpApp, TWooksHttpOptions, useHttpContext, useRequest, WooksHttp } from '@wooksjs/event-http'
import { getMoostMate, TMoostAdapter, TMoostAdapterOptions, TMoostMetadata } from 'moost'
import { TProstoRouterPathBuilder } from '@prostojs/router'

export interface THttpHandlerMeta {
    method: string
    path: string
}

export class MoostHttp implements TMoostAdapter<THttpHandlerMeta> {
    protected httpApp: WooksHttp

    constructor(httpApp?: WooksHttp | TWooksHttpOptions) {
        if (httpApp && httpApp instanceof WooksHttp) {
            this.httpApp = httpApp
        } else if (httpApp) {
            this.httpApp = createHttpApp(httpApp)
        } else {
            this.httpApp = createHttpApp()
        }
    }

    public getHttpApp() {
        return this.httpApp
    }

    public getServerCb() {
        return this.httpApp.getServerCb()
    }

    public listen(...args: Parameters<WooksHttp['listen']>) {
        return this.httpApp.listen(...args)
    }

    public readonly pathBuilders: {
        [id: string]: {
            GET?: TProstoRouterPathBuilder<Record<string, string | string[]>>
            PUT?: TProstoRouterPathBuilder<Record<string, string | string[]>>
            PATCH?: TProstoRouterPathBuilder<Record<string, string | string[]>>
            POST?: TProstoRouterPathBuilder<Record<string, string | string[]>>
            DELETE?: TProstoRouterPathBuilder<Record<string, string | string[]>>
        }
    } = {}

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
                    const interceptorHandler = await opts.getIterceptorHandler()
                    restoreCtx()
                    await interceptorHandler.init()

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
                        response = await interceptorHandler.fireBefore(response)
                        // fire request handler
                        if (!interceptorHandler.responseOverwritten) {
                            try {
                                restoreCtx()
                                response = await (instance[opts.method] as unknown as (...a: typeof args) => unknown)(...args)
                            } catch (e) {
                                response = e
                            }
                        }
                    }

                    // fire after interceptors
                    response = await interceptorHandler.fireAfter(response)
                    return response
                }
            }
            const pathBuilder = this.httpApp.on(handler.method, targetPath, fn)
            const methodMeta = getMoostMate().read(opts.fakeInstance, opts.method as string) || {} as TMoostMetadata
            const id = (methodMeta.id || opts.method) as string
            if (id) {
                const methods = this.pathBuilders[id] = this.pathBuilders[id] || {}
                if (handler.method === '*') {
                    methods.GET = pathBuilder
                    methods.PUT = pathBuilder
                    methods.PATCH = pathBuilder
                    methods.POST = pathBuilder
                    methods.DELETE = pathBuilder
                } else {
                    methods[handler.method as 'GET'] = pathBuilder
                }
            }

            opts.logHandler(`${__DYE_CYAN__}(${handler.method})${ __DYE_GREEN__ }${ targetPath }`)
        }
    }
}
