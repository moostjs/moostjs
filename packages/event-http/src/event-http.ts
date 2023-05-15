import {
    createHttpApp,
    TWooksHttpOptions,
    useHttpContext,
    useRequest,
    WooksHttp,
} from '@wooksjs/event-http'
import {
    getMoostMate,
    setControllerContext,
    TMoostAdapter,
    TMoostAdapterOptions,
    TMoostMetadata,
} from 'moost'
import { TProstoRouterPathBuilder } from '@prostojs/router'
import { createProvideRegistry } from '@prostojs/infact'
import { Server as HttpServer } from 'http'
import { Server as HttpsServer } from 'https'
import { useEventLogger } from '@wooksjs/event-core'

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

    getProvideRegistry() {
        return createProvideRegistry(
            [WooksHttp, () => this.getHttpApp()],
            ['WooksHttp', () => this.getHttpApp()],
            [
                HttpServer,
                () => this.getHttpApp().getServer() as unknown as HttpServer,
            ],
            [
                HttpsServer,
                () => this.getHttpApp().getServer() as unknown as HttpsServer,
            ]
        )
    }

    getLogger() {
        return this.getHttpApp().getLogger('moost-http')
    }

    bindHandler<T extends object = object>(
        opts: TMoostAdapterOptions<THttpHandlerMeta, T>
    ): void | Promise<void> {
        let fn
        for (const handler of opts.handlers) {
            if (handler.type !== 'HTTP') continue
            const httpPath = handler.path
            const path =
                typeof httpPath === 'string'
                    ? httpPath
                    : typeof opts.method === 'string'
                        ? opts.method
                        : ''
            const targetPath = `${opts.prefix || ''}/${path}`.replace(
                /\/\/+/g,
                '/'
            )
            if (!fn) {
                fn = async () => {
                    const { restoreCtx } = useHttpContext()
                    const { reqId, rawRequest } = useRequest()
                    const scopeId = reqId()
                    const logger = useEventLogger('moost-http')

                    rawRequest.on('end', opts.registerEventScope(scopeId)) // will unscope on request end

                    const instance = await opts.getInstance()
                    restoreCtx()

                    setControllerContext(instance, opts.method)

                    let response: unknown
                    const interceptorHandler = await opts.getIterceptorHandler()
                    restoreCtx()
                    try {
                        // logger.trace('initializing interceptors')
                        await interceptorHandler.init()
                    } catch (e) {
                        logger.error(e)
                        response = e
                    }

                    let args: unknown[] = []
                    if (!response) {
                        // params
                        restoreCtx()
                        try {
                            // logger.trace(`resolving method args for "${ opts.method as string }"`)
                            args = await opts.resolveArgs()
                            // logger.trace(`args for method "${ opts.method as string }" resolved (count ${String(args.length)})`)
                        } catch (e) {
                            logger.error(e)
                            response = e
                        }
                    }

                    if (!response) {
                        restoreCtx()
                        // fire before interceptors
                        // logger.trace('firing before interceptors')
                        response = await interceptorHandler.fireBefore(response)
                        // fire request handler
                        if (!interceptorHandler.responseOverwritten) {
                            try {
                                restoreCtx()
                                // logger.trace(`firing method "${ opts.method as string }"`)
                                response = await (
                                    instance[opts.method] as unknown as (
                                        ...a: typeof args
                                    ) => unknown
                                )(...args)
                            } catch (e) {
                                logger.error(e)
                                response = e
                            }
                        }
                    }

                    // fire after interceptors
                    restoreCtx()
                    try {
                        // logger.trace('firing after interceptors')
                        response = await interceptorHandler.fireAfter(response)
                    } catch (e) {
                        logger.error(e)
                        throw e
                    }

                    return response
                }
            }
            const { getPath: pathBuilder } = this.httpApp.on(handler.method, targetPath, fn)
            const methodMeta =
                getMoostMate().read(opts.fakeInstance, opts.method as string) ||
                ({} as TMoostMetadata)
            const id = (methodMeta.id || opts.method) as string
            if (id) {
                const methods = (this.pathBuilders[id] =
                    this.pathBuilders[id] || {})
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

            opts.logHandler(
                `${__DYE_CYAN__}(${handler.method})${__DYE_GREEN__}${targetPath}`
            )
        }
    }
}
