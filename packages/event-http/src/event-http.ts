import { createProvideRegistry } from '@prostojs/infact'
import type { IncomingMessage, ServerResponse } from 'http'
import type { TWooksHttpOptions } from '@wooksjs/event-http'
import {
  createHttpApp,
  HttpError,
  httpKind,
  useResponse,
  WooksHttp,
  WooksHttpResponse,
} from '@wooksjs/event-http'
import { seedBody } from '@wooksjs/http-body'
import type { Buffer } from 'buffer'
import { Server as HttpServer } from 'http'
import { Server as HttpsServer } from 'https'
import type {
  EventContext,
  Moost,
  TConsoleBase,
  TIsolatedSlot,
  TMoostAdapter,
  TMoostAdapterOptions,
  TMoostMetadata,
} from 'moost'
import {
  current,
  defineMoostEventHandler,
  forkEventContext,
  getMoostMate,
  globalKey,
  MOOST_ADAPTER_BRAND,
  run,
} from 'moost'
import type { ListenOptions } from 'net'

/** Marks the child context of {@link MoostHttp.invoke}. */
const invocationKey = globalKey<true>('moost-http.invocation')

const holdScopeUntilResponseCloses = {
  init: ({ unscope }: { unscope: () => void }) => {
    const ctx = current()
    if (ctx.hasOwn(invocationKey)) {
      unscope() // an invoked route answers its caller — its scope ends with the handler
      return
    }
    const res = useResponse(ctx).getRawRes(true)
    if (res.closed) {
      unscope() // the client was already gone
    } else {
      // 'close' fires once per response and unscope is idempotent: no once() wrapper needed
      res.on('close', unscope)
    }
  },
}

type TPathBuilder<ParamsType = Record<string, string | string[]>> = (params?: ParamsType) => string

/** Handler metadata for HTTP events, carrying the HTTP method and route path. */
export interface THttpHandlerMeta {
  method: string
  path: string
}

const LOGGER_TITLE = 'moost-http'

/** Options for {@link MoostHttp.invoke}. */
export interface TMoostHttpInvokeOptions {
  /**
   * The parsed request body the invoked route sees (`@Body()`, `useBody().parseBody()`).
   * Without `body` / `rawBody` the route sees an empty body — never the calling request's.
   */
  body?: unknown
  /** The raw body bytes (`@RawBody()`, `rawBody()`). Default: derived from `body` (JSON for objects). */
  rawBody?: Buffer | string
  /** The content type `useBody().is()` checks. Default: derived from `body` (`application/json` for objects). */
  contentType?: string
  /**
   * Slots (or `defineWook` composables) of the calling event that the invoked route must not
   * read through — per-event state the calling handler computed and the route must compute
   * for itself.
   */
  isolate?: Iterable<TIsolatedSlot>
  /**
   * Called with the route's child context before the route runs — seed extra slots, or keep a
   * reference to read what the route left in it once `invoke()` settled.
   */
  prepare?: (ctx: EventContext) => void
}

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
 * │      app.getLogger('MyApp').log('Up on port 3000')
 * │  })
 * │  app.init()
 * ```
 */
export class MoostHttp implements TMoostAdapter<THttpHandlerMeta> {
  /** Names this adapter for DI independently of class identity (see `MOOST_ADAPTER_BRAND`). */
  static readonly [MOOST_ADAPTER_BRAND] = '@moostjs/event-http/MoostHttp'

  public readonly name = 'http'

  protected httpApp: WooksHttp

  constructor(httpApp?: WooksHttp | TWooksHttpOptions) {
    WooksHttpResponse.registerFramework({
      image: 'https://moost.org/moost-full-logo.svg',
      link: 'https://moost.org/',
      poweredBy: 'moostjs',
      version: __VERSION__,
    })
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

  public getServerCb(onNoMatch?: (req: IncomingMessage, res: ServerResponse) => void) {
    return this.httpApp.getServerCb(onNoMatch)
  }

  /**
   * Programmatic route invocation using the Web Standard fetch API.
   * Goes through the full Moost pipeline: DI scoping, interceptors,
   * argument resolution, pipes, validation, and handler execution.
   *
   * When called from within an existing HTTP context (e.g. during SSR),
   * identity headers (authorization, cookie) are automatically forwarded.
   */
  public fetch(request: Request): Promise<Response | null> {
    return this.httpApp.fetch(request)
  }

  /**
   * Convenience wrapper for programmatic route invocation.
   * Accepts a URL string (relative paths auto-prefixed with `http://localhost`),
   * URL object, or Request, plus optional `RequestInit`.
   *
   * Returns `null` when no route matches the request.
   */
  public request(input: string | URL | Request, init?: RequestInit): Promise<Response | null> {
    return this.httpApp.request(input, init)
  }

  /**
   * Runs `fn` inside an HTTP event context seeded from a real `(req, res)` pair,
   * without route dispatch. Nested `fetch()`/`request()` calls made during `fn`
   * see this context as their caller, so `forwardHeaders` and parent `Set-Cookie`
   * propagation apply. Never writes to `res` — apply buffered response state
   * (e.g. `response.getSetCookieStrings()`) yourself.
   */
  public withHttpContext<T>(req: IncomingMessage, res: ServerResponse, fn: () => T) {
    return this.httpApp.withHttpContext(req, res, fn)
  }

  /**
   * Runs the route matching `method` + `path` inside the CURRENT HTTP event — its whole moost
   * pipeline (DI scope, guards and other interceptors, argument resolution, pipes, handler) —
   * and resolves to the handler's return value, or rejects with its error. Nothing is written
   * to the HTTP response.
   *
   * The route runs in a copy-on-write child of the current event: it reads the caller's
   * request, headers and authorization through, but sees its own body (`opts.body`), its own
   * route params, its own controller context and its own `FOR_EVENT` DI scope (released when
   * the handler settles). Status, headers and cookies it sets go to a detached response and
   * are discarded.
   *
   * Use it to delegate work to another controller's route without a network round-trip or
   * re-sending credentials. Rejects with `HttpError(404)` when no route matches.
   *
   * @example
   * ```ts
   * const http = await useControllerContext().instantiate(MoostHttp)
   * const summary = await http.invoke('POST', '/issues/actions/close', { body: { ids } })
   * ```
   */
  public invoke<R = unknown>(
    method: string,
    path: string,
    opts?: TMoostHttpInvokeOptions,
  ): Promise<R> {
    const parent = current()
    const caller = parent.has(httpKind.keys.response)
      ? parent.get(httpKind.keys.response)
      : undefined
    if (!caller) {
      throw new Error('MoostHttp.invoke() must be called inside an HTTP event')
    }
    const child = forkEventContext({ parent, isolate: opts?.isolate })
    child.setOwn(invocationKey, true)
    const ResponseCtor = caller.constructor as typeof WooksHttpResponse
    child.setOwn(
      httpKind.keys.response,
      new ResponseCtor(
        caller.getRawRes(true),
        parent.get(httpKind.keys.req),
        parent.logger,
        undefined,
        true,
      ),
    )
    seedBody(child, opts?.body, { raw: opts?.rawBody, contentType: opts?.contentType })
    opts?.prepare?.(child)
    return run(child, async () => {
      const handlers = this.httpApp.getWooks().lookupHandlers(method, path, child)
      if (!handlers?.length) {
        throw new HttpError(404, `No route for ${method} ${path}`)
      }
      // Same chain semantics as a routed request: the first handler that does not throw answers —
      // a returned Error is that answer (rejects without trying the next handler).
      let failure: unknown
      for (const handler of handlers) {
        let result: unknown
        try {
          result = await handler()
        } catch (error) {
          failure = error
          continue
        }
        if (result instanceof Error) {
          // oxlint-disable-next-line no-throw-literal -- narrowed to an Error by the check above
          throw result
        }
        return result as R
      }
      // oxlint-disable-next-line no-throw-literal -- rethrows the last handler's error as is
      throw failure
    })
  }

  public listen(
    port?: number,
    hostname?: string,
    backlog?: number,
    listeningListener?: () => void,
  ): Promise<void>
  public listen(port?: number, hostname?: string, listeningListener?: () => void): Promise<void>
  public listen(port?: number, backlog?: number, listeningListener?: () => void): Promise<void>
  public listen(port?: number, listeningListener?: () => void): Promise<void>
  public listen(path: string, backlog?: number, listeningListener?: () => void): Promise<void>
  public listen(path: string, listeningListener?: () => void): Promise<void>
  public listen(options: ListenOptions, listeningListener?: () => void): Promise<void>
  public listen(handle: any, backlog?: number, listeningListener?: () => void): Promise<void>
  public listen(handle: any, listeningListener?: () => void): Promise<void>
  public listen(
    port?: number | string | ListenOptions | any,
    hostname?: number | string | (() => void),
    backlog?: number | (() => void),
    listeningListener?: () => void,
  ) {
    return this.httpApp.listen(
      port as number,
      hostname as string,
      backlog as number,
      listeningListener,
    )
  }

  public readonly pathBuilders: Record<
    string,
    {
      GET?: TPathBuilder
      PUT?: TPathBuilder
      PATCH?: TPathBuilder
      POST?: TPathBuilder
      DELETE?: TPathBuilder
    }
  > = {}

  async onNotFound() {
    this.notFoundHandler ??= defineMoostEventHandler({
      loggerTitle: LOGGER_TITLE,
      getIterceptorHandler: () => this.moost?.getGlobalInterceptorHandler(),
      getControllerInstance: () => this.moost,
      callControllerMethod: () => new HttpError(404, 'Resource Not Found'),
      manualUnscope: true,
      hooks: holdScopeUntilResponseCloses,
      targetPath: '',
      handlerType: '__SYSTEM__',
    })
    return this.notFoundHandler()
  }

  protected moost?: Moost

  private notFoundHandler?: () => unknown

  onInit(moost: Moost) {
    this.moost = moost
  }

  /**
   * Called by `Moost.dispose()` before any `@MoostDispose` hook runs: stops the
   * HTTP server this adapter started through {@link MoostHttp.listen}, so
   * shutdown drains in-flight requests before singletons release what they own.
   *
   * A no-op when no server is listening — the adapter was used as a middleware
   * (`getServerCb()`), `listen()` was never called (or failed), or the server is
   * already closed. Guarding on the live server avoids wooks' `close()`
   * never-settling (no server) and Node's `ERR_SERVER_NOT_RUNNING` (closed).
   */
  async onDispose() {
    if (!this.httpApp.getServer()?.listening) {
      return
    }
    await this.httpApp.close()
  }

  getProvideRegistry() {
    return createProvideRegistry(
      [WooksHttp, () => this.getHttpApp()],
      ['WooksHttp', () => this.getHttpApp()],
      [HttpServer, () => this.getHttpApp().getServer() as unknown as HttpServer],
      [HttpsServer, () => this.getHttpApp().getServer() as unknown as HttpsServer],
    )
  }

  getLogger(): TConsoleBase {
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
      const targetPath = `${`${opts.prefix || ''}/${path}`.replaceAll(/\/\/+/g, '/')}${
        path.endsWith('//') ? '/' : ''
      }` // explicit double slash "//" -> force url to end with slash

      const isUpgrade = handler.method === 'UPGRADE'
      fn = defineMoostEventHandler({
        loggerTitle: LOGGER_TITLE,
        getIterceptorHandler: opts.getIterceptorHandler,
        getControllerInstance: opts.getInstance,
        controllerMethod: opts.method,
        controllerName: opts.controllerName,
        resolveArgs: opts.resolveArgs,
        // An upgrade never completes an HTTP response (the socket is handed to the WS
        // server), so its scope ends with the handler. Every other request's scope is
        // also held until the RESPONSE is done — sent or aborted (the request's own
        // 'end'/'close' fire as soon as its body is consumed).
        manualUnscope: !isUpgrade,
        hooks: isUpgrade ? undefined : holdScopeUntilResponseCloses,
        targetPath,
        controllerPrefix: opts.prefix,
        handlerType: handler.type,
      })

      const routerBinding = isUpgrade
        ? this.httpApp.upgrade(targetPath, fn)
        : this.httpApp.on(handler.method, targetPath, fn)
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
      args.forEach((a) => (params[a] = `{${a}}`))
      opts.register(handler, routerBinding.getPath(params), args)
    }
  }
}
