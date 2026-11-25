import { once } from 'node:events'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Server } from 'node:net'
import type { TCacheControlOptions, TPrecompressedOptions, TSpaShell } from './prod-static'
import {
  apiMountNoMatch,
  createStaticHandler,
  loadSpaShell,
  presetHeader,
  resolveCacheControl,
  resolvePrecompressed,
  sendSpaShell,
} from './prod-static'
import { devSSRFallback } from './dev-ssr'
import type { TDevSSRFallbackOptions } from './dev-ssr'
import type { TConnectMiddleware } from './server-middleware'
import {
  assertMiddleware,
  failRequest,
  runMiddlewares,
  SERVER_PLUGIN_NAME,
  setResponseHeaders,
  validateHeaders,
} from './server-middleware'
import type { TSSRHttpContextRunner, TSSRRender } from './utils'
import {
  DEFAULT_SSR_HEAD,
  DEFAULT_SSR_OUTLET,
  DEFAULT_SSR_STATE,
  matchesPrefix,
  normalizePrefixes,
  renderSSRPage,
  sendSSRResponse,
} from './utils'

export type { TSSRRender, TSSRRenderContext, TSSRRenderResult } from './utils'
export type { TCacheControlOptions, TPrecompressedOptions } from './prod-static'

export interface TSSRServerOptions {
  /** Override: lazy import for the Moost app entry. */
  entry?: (() => Promise<unknown>) | string
  /** Override: SSR entry module path (e.g., '/src/entry-server.ts') */
  ssrEntry?: string
  /**
   * Override: URL mount(s) for Moost routes (e.g., '/api' or ['/api', '/.well-known']).
   * Requests outside every mount skip the Moost router (optimization/guard).
   * A prefix is an API mount: an unmatched route under it gets Moost's own
   * 404 (JSON), never the SPA shell or an SSR page (see `prefixFallthrough`).
   * When omitted (and not baked by the plugin), every request enters Moost first
   * and unmatched routes fall through to static/SSR — same as dev.
   */
  prefix?: string | string[]
  /**
   * Override: let unmatched routes under `prefix` fall through to static files
   * and the SPA/SSR page instead of answering Moost's 404.
   * Default: baked from the plugin's `prefixFallthrough` option (`false`).
   */
  prefixFallthrough?: boolean
  /** Override: port number (default: process.env.PORT || 3000) */
  port?: number
  /** Override: bind address, e.g. '127.0.0.1' (default: process.env.HOST, else all interfaces) */
  host?: string
  /** Override: client build directory (default: 'dist/client') */
  clientDir?: string
  /** Override: HTML placeholder for SSR content */
  ssrOutlet?: string
  /** Override: HTML placeholder for SSR state */
  ssrState?: string
  /** Override: HTML placeholder for SSR-rendered `<head>` tags */
  ssrHead?: string
  /**
   * Override: run each SSR render inside an HTTP event context seeded from the
   * incoming page request, so SSR-time `fetch('/api/...')` self-calls inherit
   * the viewer's identity headers (authorization, cookie, accept-language,
   * x-forwarded-for, x-request-id — see the adapter's `forwardHeaders` option)
   * and their `Set-Cookie` headers land on the page response.
   * Set to `false` to keep SSR self-calls anonymous. Default: `true`.
   */
  ssrFetchForwarding?: boolean
  /**
   * Production only. Serve the precompressed `<file>.br` / `<file>.gz` siblings
   * written by the plugin's `precompress` build step to clients that accept
   * them (`Content-Encoding` + `Vary: Accept-Encoding`). Applies to static
   * files and the SPA fallback page.
   * Default: baked from the plugin's `precompress` option (on).
   */
  precompressed?: boolean | TPrecompressedOptions
  /**
   * Production only. `Cache-Control` policy: hashed files under the assets
   * directory are `immutable` for a year, other static files and HTML pages
   * are `no-cache` (revalidated through the `ETag`). A `Cache-Control` already
   * set by a middleware, the app or the SSR render is never overridden.
   * An object is merged over the plugin's `cacheControl` option; `false` sends
   * no `Cache-Control` from the server.
   * Default: baked from the plugin's `cacheControl` option (on).
   */
  cacheControl?: boolean | TCacheControlOptions
  /**
   * Override: headers set on every response the server sends — Moost routes,
   * SSR pages, the SPA shell and static files — in dev and production. They are
   * set first, so a `use()` middleware, a route or the SSR render's `headers`
   * replace them. Replaces the plugin's `headers` option entirely. Invalid names
   * or values throw at startup.
   */
  headers?: Record<string, string>
}

export interface TSSRServer {
  /**
   * Add Connect-style `(req, res, next)` middleware. Middlewares run in order, after the
   * `headers` option and before Moost routes, static files and the SPA/SSR page — in dev
   * also before Vite's module and file serving (only Vite's own request checks, host
   * validation and CORS handling run earlier). `next(error)`, a throw or a rejected promise
   * fails the request (dev: Vite's error page; production: the error's `status` /
   * `statusCode`, else `500`, with an empty body). Error-handling `(err, req, res, next)`
   * middleware is not supported and throws.
   */
  use(middleware: TConnectMiddleware): void
  /**
   * Start the server; resolves with the bound server (for `address()` / `close()`)
   * and rejects on a bind error (`EADDRINUSE`, `EACCES`, bad host).
   * `port`/`host` and the matching options apply in production only — in dev,
   * Vite's `server.port`/`server.host` do.
   */
  listen(port?: number, host?: string): Promise<Server>
}

// Declared globally by the plugin's `define` during build:app.
// In dev mode these are never evaluated (inside `if (isProd)` block).
declare const __MOOST_ENTRY__: string
declare const __MOOST_SSR_ENTRY__: string
declare const __MOOST_PREFIX__: string | string[] | null
declare const __MOOST_PREFIX_FALLTHROUGH__: boolean
declare const __MOOST_SSR_OUTLET__: string
declare const __MOOST_SSR_STATE__: string
declare const __MOOST_SSR_HEAD__: string
declare const __MOOST_SSR_FORWARDING__: boolean
declare const __MOOST_PRECOMPRESS__: TPrecompressedOptions | false
declare const __MOOST_CACHE_CONTROL__: TCacheControlOptions | false
declare const __MOOST_HEADERS__: Record<string, string> | null
declare const __MOOST_CSP_NONCE__: string | null

/** URL of the address the server actually bound (wildcard binds print as localhost). */
function serverUrl(server: Server): string {
  const addr = server.address()
  if (!addr || typeof addr === 'string') {
    return String(addr)
  }
  const wildcard = addr.address === '::' || addr.address === '0.0.0.0'
  const host = wildcard ? 'localhost' : addr.family === 'IPv6' ? `[${addr.address}]` : addr.address
  return `http://${host}:${addr.port}`
}

function stripUndefined(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined))
}

export async function createSSRServer(options?: TSSRServerOptions): Promise<TSSRServer> {
  const userMiddlewares: TConnectMiddleware[] = []
  const opts = options ? stripUndefined(options as Record<string, unknown>) : {}
  validateHeaders(
    opts.headers as Record<string, string> | undefined,
    'createSSRServer({ headers })',
  )
  const use = (middleware: TConnectMiddleware) => {
    assertMiddleware(middleware)
    userMiddlewares.push(middleware)
  }

  // In library dist: process.env.NODE_ENV stays as-is → both branches preserved.
  // In consumer's build:app: plugin defines process.env.NODE_ENV → 'production' → DCE removes dev branch.
  const isProd = process.env.MOOST_DEFERRED_ENV === 'production'

  // ─── DEV MODE ───
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite')
    // One inline plugin wires this server into Vite. Its `pre` configureServer hook registers
    // the `headers` option and the use() middlewares ahead of Vite's file serving and the
    // plugin's Moost middleware (only Vite's request checks, host validation and CORS come
    // first), and the SSR page fallback after Vite's middlewares — with this server's
    // overrides; the plugin's own fallback stands down. Vite runs the hook again for the new
    // server on server.restart(), so the middlewares and the fallback survive a restart.
    const vite = await createViteServer({
      plugins: [
        {
          name: SERVER_PLUGIN_NAME,
          configureServer: {
            order: 'pre',
            handler(server) {
              const exposed = server.config as Record<string, any>
              const config = { ...exposed.__moostViteOptions, ...opts }
              const headers = config.headers as Record<string, string> | undefined
              server.middlewares.use((req, res, next) => {
                setResponseHeaders(res, headers)
                runMiddlewares(userMiddlewares, req, res, next)
              })
              const ssrEntry = config.ssrEntry as string | undefined
              if (!ssrEntry) {
                return
              }
              const httpRef = exposed.__moostViteHttpRef as
                | { current: TSSRHttpContextRunner | null }
                | undefined
              const forwarding = config.ssrFetchForwarding !== false
              const fallback = devSSRFallback(server, {
                ssrEntry,
                markers: {
                  ssrOutlet: config.ssrOutlet || DEFAULT_SSR_OUTLET,
                  ssrState: config.ssrState || DEFAULT_SSR_STATE,
                  ssrHead: config.ssrHead || DEFAULT_SSR_HEAD,
                },
                http: () => (forwarding ? httpRef?.current : null),
                gate: exposed.__moostViteSsrGate as TDevSSRFallbackOptions['gate'],
              })
              return () => {
                server.middlewares.use(fallback)
              }
            },
          },
        },
      ],
    })

    return {
      use,
      async listen(port, host) {
        if ((port ?? host ?? opts.port ?? opts.host) !== undefined) {
          console.warn(
            '[moost-vite] port/host passed to createSSRServer() or listen() are ignored in dev — set server.port / server.host in vite.config instead.',
          )
        }
        await vite.listen()
        vite.printUrls()
        // vite.listen() throws when there is no HTTP server (middlewareMode).
        return vite.httpServer as Server
      },
    }
  }

  // ─── PROD MODE ───
  // Config comes from __MOOST_* defines (baked in by plugin during build:app),
  // with user options as overrides.
  const fs = await import('node:fs/promises')
  const path = await import('node:path')
  const { createServer: createHttpServer } = await import('node:http')

  const clientDir = (opts.clientDir as string) || path.resolve(import.meta.dirname, '../client')
  const ssrOutlet =
    (opts.ssrOutlet as string) ||
    (__MOOST_SSR_OUTLET__ !== undefined ? __MOOST_SSR_OUTLET__ : DEFAULT_SSR_OUTLET)
  const ssrState =
    (opts.ssrState as string) ||
    (__MOOST_SSR_STATE__ !== undefined ? __MOOST_SSR_STATE__ : DEFAULT_SSR_STATE)
  const ssrHead =
    (opts.ssrHead as string) ||
    (__MOOST_SSR_HEAD__ !== undefined ? __MOOST_SSR_HEAD__ : DEFAULT_SSR_HEAD)
  // `undefined` means no gate: every request enters Moost first and unmatched
  // routes fall through to static/SSR — identical to the dev middleware contract.
  const prefixes = normalizePrefixes(
    (opts.prefix as string | string[] | undefined) ?? __MOOST_PREFIX__,
  )
  const prefixFallthrough =
    (opts.prefixFallthrough as boolean | undefined) ?? __MOOST_PREFIX_FALLTHROUGH__ ?? false
  const ssrForwarding =
    (opts.ssrFetchForwarding as boolean | undefined) ?? __MOOST_SSR_FORWARDING__ ?? true
  const variants = resolvePrecompressed(
    __MOOST_PRECOMPRESS__,
    opts.precompressed as boolean | TPrecompressedOptions | undefined,
  )
  const cache = resolveCacheControl(
    __MOOST_CACHE_CONTROL__,
    opts.cacheControl as boolean | TCacheControlOptions | undefined,
  )
  const defaultPort = (opts.port as number) || Number(process.env.PORT) || 3000
  const defaultHost = (opts.host as string | undefined) ?? process.env.HOST
  const headers = (opts.headers as Record<string, string> | undefined) ?? __MOOST_HEADERS__
  const cspNonce = __MOOST_CSP_NONCE__ ?? undefined

  // Read HTML template once at startup
  const template = await fs.readFile(path.resolve(clientDir, 'index.html'), 'utf8')

  // SSR render function (if ssrEntry is configured), otherwise SPA fallback
  let render: TSSRRender | null = null
  const hasSsr = __MOOST_SSR_ENTRY__ !== undefined && !!__MOOST_SSR_ENTRY__
  if (hasSsr) {
    const ssrModule = await import(/* @vite-ignore */ __MOOST_SSR_ENTRY__)
    render = ssrModule.render
  }

  // Patch MoostHttp.listen to capture the handler instead of binding a port
  const { MoostHttp, enableLocalFetch } = await import('@moostjs/event-http')
  let moostHandler: ((req: IncomingMessage, res: ServerResponse) => void) | null = null
  const moostHttpRef: { instance: any } = { instance: null }
  let captured = false
  const origListen = MoostHttp.prototype.listen
  MoostHttp.prototype.listen = function (...args: any[]) {
    // A route miss: under an API mount, a static file (GET/HEAD) or Moost's own 404 — never
    // the SPA/SSR page; otherwise it falls through to static/SSR, the same contract as the
    // dev middleware's onNoMatch → next(). serveStatic is assigned below, before any request
    // can reach this callback.
    moostHandler = this.getServerCb(
      prefixes && !prefixFallthrough
        ? apiMountNoMatch((req, res, miss) => serveStatic(req, res, miss), this.getServerCb())
        : (req, res) => serveStatic(req, res),
    )
    moostHttpRef.instance = this
    captured = true
    setTimeout(() => args.filter((a: any) => typeof a === 'function').forEach((a: any) => a()), 1)
    return Promise.resolve()
  }

  // Import moost entry — __MOOST_ENTRY__ is replaced by define during build:app.
  // The plugin adds the Moost entry as its own Rollup input, so this becomes a
  // built relative path next to server.js (e.g. await import("./main.js")). The
  // @vite-ignore keeps rolldown from trying to resolve the substituted literal
  // against node_modules/@moostjs/vite/dist/; Node resolves it at runtime
  // relative to this module (dist/server/server.js).
  if (typeof opts.entry === 'function') {
    await opts.entry()
  } else if (typeof opts.entry === 'string') {
    await import(/* @vite-ignore */ opts.entry)
  } else {
    await import(/* @vite-ignore */ __MOOST_ENTRY__)
  }

  // Fire-and-forget async entries (e.g. `startServer().catch(...)`) let the
  // import resolve before listen() is called — wait up to 30s for capture.
  if (!captured) {
    const deadline = Date.now() + 30_000
    while (!captured && Date.now() < deadline) {
      await new Promise<void>((resolve) => setTimeout(resolve, 10))
    }
    if (!captured) {
      console.warn(
        '[moost-vite] MoostHttp.listen was not called within 30s after entry import. The Moost HTTP handler will not be active. Ensure your entry uses top-level await for async setup.',
      )
    }
  }

  // Restore original listen
  MoostHttp.prototype.listen = origListen

  // Enable local fetch for SSR — fetch('/api/...') calls moost handler in-process
  if (enableLocalFetch && moostHttpRef.instance) {
    enableLocalFetch(moostHttpRef.instance)
  }

  // SPA shell + its precompressed siblings (SSR renders every page instead)
  const spaShell: TSpaShell = render
    ? { html: template }
    : await loadSpaShell(clientDir, template, variants)

  /** HTML page fallback: SSR render or the SPA shell. */
  const servePage = async (req: IncomingMessage, res: ServerResponse) => {
    if (req.method !== 'GET') {
      res.statusCode = 404
      res.end()
      return
    }
    try {
      if (render) {
        const result = await renderSSRPage({
          render,
          url: req.url || '/',
          req,
          res,
          http: ssrForwarding ? (moostHttpRef.instance as TSSRHttpContextRunner | null) : null,
        })
        // Before the render's own headers, which may override it.
        if (cache?.html) {
          presetHeader(res, 'Cache-Control', cache.html)
        }
        sendSSRResponse(res, template, { ssrOutlet, ssrState, ssrHead, cspNonce }, result)
      } else {
        sendSpaShell(req, res, spaShell, cache)
      }
    } catch (error: any) {
      console.error(error)
      res.statusCode = 500
      res.end(error.message)
    }
  }

  // Static assets → sirv, then SSR render or SPA fallback
  const serveStatic = await createStaticHandler(
    path.resolve(clientDir),
    variants,
    cache,
    (req, res) => void servePage(req, res),
  )

  return {
    use,
    async listen(port, host) {
      const server = createHttpServer((req, res) => {
        const url = req.url || '/'

        // 0. The `headers` option — first, so everything below can replace them
        setResponseHeaders(res, headers)

        // 1. User middlewares (sequential); a failing one answers with its status
        runMiddlewares(userMiddlewares, req, res, (error) => {
          if (error) {
            failRequest(res, error)
            return
          }
          // 2. Moost first — gated to the configured mounts when prefix is set
          //    (pure fast path); a route miss goes to the no-match callback.
          if (moostHandler && (!prefixes || matchesPrefix(url, prefixes))) {
            moostHandler(req, res)
            return
          }

          // 3. Static assets → sirv, then SSR render or SPA fallback
          serveStatic(req, res)
        })
      })
      server.listen(port || defaultPort, host || defaultHost)
      await once(server, 'listening')
      console.log(`Server running at ${serverUrl(server)}`)
      return server
    },
  }
}
