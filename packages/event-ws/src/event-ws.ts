import { createProvideRegistry } from '@prostojs/infact'
import type { TWooksWsOptions } from '@wooksjs/event-ws'
import { createWsApp, WooksWs } from '@wooksjs/event-ws'
import type { Moost, TConsoleBase, TMoostAdapter, TMoostAdapterOptions } from 'moost'
import { defineMoostEventHandler } from 'moost'

/** Handler metadata for routed WebSocket message events. */
export interface TWsMessageHandlerMeta {
  event: string
  path: string
}

/** Handler metadata for WebSocket connection events. */
export interface TWsConnectHandlerMeta {
  // no extra fields
}

/** Union of all WebSocket handler metadata types. */
export type TWsHandlerMeta = TWsMessageHandlerMeta | TWsConnectHandlerMeta

/** Configuration options for the MoostWs adapter. */
export interface TMoostWsOpts {
  /**
   * WooksWs options or instance
   */
  wooksWs?: WooksWs | TWooksWsOptions
}

const LOGGER_TITLE = 'moost-ws'

/**
 * ## Moost WebSocket Adapter
 *
 * Moost Adapter for WebSocket events, wrapping @wooksjs/event-ws.
 * Supports standalone and HTTP-integrated modes.
 *
 * ### HTTP-integrated mode (recommended)
 * ```ts
 * |  import { MoostHttp, Upgrade } from '@moostjs/event-http'
 * |  import { MoostWs, Message, MessageData } from '@moostjs/event-ws'
 * |  import { Moost, Param, Controller, Injectable } from 'moost'
 * |
 * |  @Controller()
 * |  class AppController {
 * |      constructor(private ws: WooksWs) {}
 * |
 * |      @Upgrade('/ws')
 * |      handleUpgrade() { return this.ws.upgrade() }
 * |  }
 * |
 * |  @Controller('chat')
 * |  class ChatController {
 * |      @Message('message', 'rooms/:roomId')
 * |      onMessage(@Param('roomId') roomId: string, @MessageData() data: unknown) {
 * |          return { received: true, roomId }
 * |      }
 * |  }
 * |
 * |  const app = new Moost()
 * |  const http = new MoostHttp()
 * |  const ws = new MoostWs({ httpApp: http.getHttpApp() })
 * |  app.adapter(http)
 * |  app.adapter(ws)
 * |  app.registerControllers(AppController, ChatController)
 * |  http.listen(3000)
 * |  app.init()
 * ```
 */
export class MoostWs implements TMoostAdapter<TWsHandlerMeta> {
  public readonly name = 'ws'

  protected wsApp: WooksWs

  constructor(
    protected opts?: TMoostWsOpts & {
      /**
       * WooksHttp instance or an adapter with getHttpApp() for HTTP-integrated mode.
       * When provided, the WS adapter shares the HTTP server.
       * Use @Upgrade() decorator on a handler method to register the upgrade route.
       */
      httpApp?: { getHttpApp(): unknown } | object
    },
  ) {
    const wsOpts = opts?.wooksWs
    if (wsOpts && wsOpts instanceof WooksWs) {
      this.wsApp = wsOpts
    } else {
      const httpApp =
        opts?.httpApp && 'getHttpApp' in opts.httpApp ? opts.httpApp.getHttpApp() : opts?.httpApp
      if (httpApp) {
        this.wsApp = createWsApp(httpApp as Parameters<typeof createWsApp>[0], wsOpts || {})
      } else {
        this.wsApp = createWsApp(wsOpts || {})
      }
    }
  }

  public getWsApp() {
    return this.wsApp
  }

  /**
   * Start a standalone WebSocket server (without HTTP integration).
   */
  public listen(port: number, hostname?: string) {
    return this.wsApp.listen(port, hostname)
  }

  /**
   * Stop the server, close all connections, clean up heartbeat.
   */
  public close() {
    return this.wsApp.close()
  }

  protected moost?: Moost

  onInit(moost: Moost) {
    this.moost = moost
  }

  getProvideRegistry() {
    return createProvideRegistry(
      [MoostWs, () => this],
      ['MoostWs', () => this],
      [WooksWs, () => this.getWsApp()],
      ['WooksWs', () => this.getWsApp()],
    )
  }

  getLogger(): TConsoleBase {
    return this.wsApp.getLogger('[moost-ws]')
  }

  bindHandler<T extends object = object>(opts: TMoostAdapterOptions<TWsHandlerMeta, T>): void {
    for (const handler of opts.handlers) {
      if (handler.type === 'WS_MESSAGE') {
        this.bindMessageHandler(opts, handler as TWsMessageHandlerMeta & { type: string })
      } else if (handler.type === 'WS_CONNECT') {
        this.bindConnectHandler(opts)
      } else if (handler.type === 'WS_DISCONNECT') {
        this.bindDisconnectHandler(opts)
      }
    }
  }

  protected bindMessageHandler<T extends object>(
    opts: TMoostAdapterOptions<TWsHandlerMeta, T>,
    handler: TWsMessageHandlerMeta & { type: string },
  ) {
    const event = handler.event
    const path =
      typeof handler.path === 'string'
        ? handler.path
        : typeof opts.method === 'string'
          ? opts.method
          : ''
    const targetPath = `${`${opts.prefix || ''}/${path}`.replaceAll(/\/\/+/g, '/')}`

    const fn = defineMoostEventHandler({
      contextType: 'WS_MESSAGE',
      loggerTitle: LOGGER_TITLE,
      getIterceptorHandler: opts.getIterceptorHandler,
      getControllerInstance: opts.getInstance,
      controllerMethod: opts.method,
      controllerName: opts.controllerName,
      resolveArgs: opts.resolveArgs,
      targetPath,
      handlerType: handler.type,
    })

    this.wsApp.onMessage(event, targetPath, fn)

    opts.logHandler(`${__DYE_CYAN__}(ws:${event})${__DYE_GREEN__}${targetPath}`)
    opts.register(handler, targetPath, [])
  }

  protected bindConnectHandler<T extends object>(opts: TMoostAdapterOptions<TWsHandlerMeta, T>) {
    const fn = defineMoostEventHandler({
      contextType: 'WS_CONNECT',
      loggerTitle: LOGGER_TITLE,
      getIterceptorHandler: opts.getIterceptorHandler,
      getControllerInstance: opts.getInstance,
      controllerMethod: opts.method,
      resolveArgs: opts.resolveArgs,
      targetPath: '__ws_connect__',
      handlerType: 'WS_CONNECT',
    })

    this.wsApp.onConnect(fn)

    opts.logHandler(`${__DYE_CYAN__}(ws:connect)`)
    opts.register({ type: 'WS_CONNECT' }, '__ws_connect__', [])
  }

  protected bindDisconnectHandler<T extends object>(opts: TMoostAdapterOptions<TWsHandlerMeta, T>) {
    const fn = defineMoostEventHandler({
      contextType: 'WS_DISCONNECT',
      loggerTitle: LOGGER_TITLE,
      getIterceptorHandler: opts.getIterceptorHandler,
      getControllerInstance: opts.getInstance,
      controllerMethod: opts.method,
      resolveArgs: opts.resolveArgs,
      targetPath: '__ws_disconnect__',
      handlerType: 'WS_DISCONNECT',
    })

    this.wsApp.onDisconnect(fn)

    opts.logHandler(`${__DYE_CYAN__}(ws:disconnect)`)
    opts.register({ type: 'WS_DISCONNECT' }, '__ws_disconnect__', [])
  }
}
