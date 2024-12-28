/* eslint-disable sonarjs/no-nested-template-literals */
/* eslint-disable @typescript-eslint/unified-signatures */
import { createProvideRegistry } from '@prostojs/infact'
import type { TProstoRouterPathBuilder } from '@prostojs/router'
import type { TWooksHttpOptions } from '@wooksjs/event-http'
import { createHttpApp, HttpError, useRequest, WooksHttp } from '@wooksjs/event-http'
import { Server as HttpServer } from 'http'
import { Server as HttpsServer } from 'https'
import type { Moost, TMoostAdapter, TMoostAdapterOptions, TMoostMetadata } from 'moost'
import { defineMoostEventHandler, getMoostMate } from 'moost'
import type { ListenOptions } from 'net'

export interface THttpHandlerMeta {
  method: string
  path: string
}

const LOGGER_TITLE = 'moost-http'
const CONTEXT_TYPE = 'HTTP'

/**
 * ## Moost HTTP Adapter
 *
 * Moost Adapter for HTTP events
 *
 * ```ts
 * │  // HTTP server example
 * │  import { MoostHttp, Get } from '@moostjs/event-http'
 * │  import { Moost, Param } from 'moost'
 * │
 * │  class MyServer extends Moost {
 * │      @Get('test/:name')
 * │      test(@Param('name') name: string) {
 * │          return { message: `Hello ${name}!` }
 * │      }
 * │  }
 * │
 * │  const app = new MyServer()
 * │  const http = new MoostHttp()
 * │  app.adapter(http).listen(3000, () => {
 * │      app.getLogger('[MyApp]').log('Up on port 3000')
 * │  })
 * │  app.init()
 * ```
 */
export class MoostHttp implements TMoostAdapter<THttpHandlerMeta> {
  public readonly name = 'http'

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

  public listen(
    port?: number,
    hostname?: string,
    backlog?: number,
    listeningListener?: () => void
  ): Promise<void>
  public listen(port?: number, hostname?: string, listeningListener?: () => void): Promise<void>
  public listen(port?: number, backlog?: number, listeningListener?: () => void): Promise<void>
  public listen(port?: number, listeningListener?: () => void): Promise<void>
  public listen(path: string, backlog?: number, listeningListener?: () => void): Promise<void>
  public listen(path: string, listeningListener?: () => void): Promise<void>
  public listen(options: ListenOptions, listeningListener?: () => void): Promise<void>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public listen(handle: any, backlog?: number, listeningListener?: () => void): Promise<void>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public listen(handle: any, listeningListener?: () => void): Promise<void>
  public listen(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    port?: number | string | ListenOptions | any,
    hostname?: number | string | (() => void),
    backlog?: number | (() => void),
    listeningListener?: () => void
  ) {
    return this.httpApp.listen(
      port as number,
      hostname as string,
      backlog as number,
      listeningListener
    )
  }

  public readonly pathBuilders: Record<
    string,
    {
      GET?: TProstoRouterPathBuilder<Record<string, string | string[]>>
      PUT?: TProstoRouterPathBuilder<Record<string, string | string[]>>
      PATCH?: TProstoRouterPathBuilder<Record<string, string | string[]>>
      POST?: TProstoRouterPathBuilder<Record<string, string | string[]>>
      DELETE?: TProstoRouterPathBuilder<Record<string, string | string[]>>
    }
  > = {}

  async onNotFound() {
    return defineMoostEventHandler({
      loggerTitle: LOGGER_TITLE,
      getIterceptorHandler: () => this.moost?.getGlobalInterceptorHandler(),
      getControllerInstance: () => this.moost,
      callControllerMethod: () => new HttpError(404, 'Resource Not Found'),
      targetPath: '',
      handlerType: '__SYSTEM__',
    })()
  }

  protected moost?: Moost

  onInit(moost: Moost) {
    this.moost = moost
  }

  getProvideRegistry() {
    return createProvideRegistry(
      [WooksHttp, () => this.getHttpApp()],
      ['WooksHttp', () => this.getHttpApp()],
      [HttpServer, () => this.getHttpApp().getServer() as unknown as HttpServer],
      [HttpsServer, () => this.getHttpApp().getServer() as unknown as HttpsServer]
    )
  }

  getLogger() {
    return this.getHttpApp().getLogger('[moost-http]')
  }

  bindHandler<T extends object = object>(opts: TMoostAdapterOptions<THttpHandlerMeta, T>): void {
    let fn
    for (const handler of opts.handlers) {
      if (handler.type !== 'HTTP') {
        continue
      }
      const httpPath = handler.path
      const path =
        typeof httpPath === 'string' ? httpPath : typeof opts.method === 'string' ? opts.method : ''
      const targetPath = `${`${opts.prefix || ''}/${path}`.replace(/\/\/+/g, '/')}${
        path.endsWith('//') ? '/' : ''
      }` // explicit double slash "//" -> force url to end with slash

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
        targetPath,
        handlerType: handler.type,
      })

      const routerBinding = this.httpApp.on(handler.method, targetPath, fn)
      const { getPath: pathBuilder } = routerBinding
      const methodMeta =
        getMoostMate().read(opts.fakeInstance, opts.method as string) || ({} as TMoostMetadata)
      const id = (methodMeta.id || opts.method) as string
      if (id) {
        const methods = (this.pathBuilders[id] = this.pathBuilders[id] || {})
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

      opts.logHandler(`${__DYE_CYAN__}(${handler.method})${__DYE_GREEN__}${targetPath}`)
      const args = routerBinding.getArgs()
      const params: Record<string, string> = {}
      args.forEach(a => (params[a] = `{${a}}`))
      opts.register(handler, routerBinding.getPath(params), args)
    }
  }
}
