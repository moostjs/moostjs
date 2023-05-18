import {
    createHttpApp,
    HttpError,
    TWooksHttpOptions,
    useRequest,
    WooksHttp,
} from '@wooksjs/event-http'
import {
    defineMoostEventHandler,
    getMoostMate,
    Moost,
    TMoostAdapter,
    TMoostAdapterOptions,
    TMoostMetadata,
} from 'moost'
import { TProstoRouterPathBuilder } from '@prostojs/router'
import { createProvideRegistry } from '@prostojs/infact'
import { Server as HttpServer } from 'http'
import { Server as HttpsServer } from 'https'

export interface THttpHandlerMeta {
    method: string
    path: string
}

const LOGGER_TITLE = 'moost-http'
const CONTEXT_TYPE = 'HTTP'

export class MoostHttp implements TMoostAdapter<THttpHandlerMeta> {
    protected httpApp: WooksHttp

    constructor(httpApp?: WooksHttp | TWooksHttpOptions) {
        if (httpApp && httpApp instanceof WooksHttp) {
            this.httpApp = httpApp
        } else if (httpApp) {
            this.httpApp = createHttpApp({
                ...httpApp,
                onNotFound: this.onNotFound.bind(this),
            })
        } else {
            this.httpApp = createHttpApp({
                onNotFound: this.onNotFound.bind(this),
            })
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

    async onNotFound() {
        const response = await defineMoostEventHandler({
            loggerTitle: LOGGER_TITLE,
            getIterceptorHandler: () => this.moost?.getGlobalInterceptorHandler(),
            getControllerInstance: () => this.moost,
            callControllerMethod: () => undefined,
        })()
        if (!response) {
            throw new HttpError(404, 'Resource Not Found')
        }
    }

    protected moost?: Moost

    onInit(moost: Moost) {
        this.moost = moost
    }    

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
                fn = defineMoostEventHandler({
                    contextType: CONTEXT_TYPE,
                    loggerTitle: LOGGER_TITLE,
                    getIterceptorHandler: opts.getIterceptorHandler,
                    getControllerInstance: opts.getInstance,
                    controllerMethod: opts.method,
                    resolveArgs: opts.resolveArgs,
                    manualUnscope: true,
                    hooks: {
                        init: ({ unscope }) => {
                            const { rawRequest } = useRequest()
                            rawRequest.on('end', unscope) // will unscope on request end
                        },
                    },
                })
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
