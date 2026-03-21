import type { IncomingMessage, ServerResponse } from 'node:http'
import { DEFAULT_SSR_OUTLET, DEFAULT_SSR_STATE } from './utils'

type TMiddleware = (req: IncomingMessage, res: ServerResponse, next: () => void) => void

export interface TSSRServerOptions {
  /** Override: lazy import for the Moost app entry. */
  entry?: (() => Promise<unknown>) | string
  /** Override: SSR entry module path (e.g., '/src/entry-server.ts') */
  ssrEntry?: string
  /** Override: URL prefix for API routes (e.g., '/api') */
  prefix?: string
  /** Override: port number (default: process.env.PORT || 3000) */
  port?: number
  /** Override: client build directory (default: 'dist/client') */
  clientDir?: string
  /** Override: HTML placeholder for SSR content */
  ssrOutlet?: string
  /** Override: HTML placeholder for SSR state */
  ssrState?: string
}

export interface TSSRServer {
  /** Add Connect-compatible middleware (runs in both dev and prod) */
  use(middleware: TMiddleware): void
  /** Start the server */
  listen(port?: number): Promise<void>
}

// Declared globally by the plugin's `define` during build:app.
// In dev mode these are never evaluated (inside `if (isProd)` block).
declare const __MOOST_ENTRY__: string
declare const __MOOST_SSR_ENTRY__: string
declare const __MOOST_PREFIX__: string
declare const __MOOST_SSR_OUTLET__: string
declare const __MOOST_SSR_STATE__: string

function stripUndefined(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined))
}

export async function createSSRServer(options?: TSSRServerOptions): Promise<TSSRServer> {
  const userMiddlewares: TMiddleware[] = []
  const opts = options ? stripUndefined(options as Record<string, unknown>) : {}

  // ─── DEV MODE ───
  // In library dist: process.env.NODE_ENV stays as-is → both branches preserved.
  // In consumer's build:app: plugin defines process.env.NODE_ENV → 'production' → DCE removes dev branch.
  const isProd = process.env.MOOST_DEFERRED_ENV === 'production'

  // ─── DEV MODE ───
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite')
    const vite = await createViteServer()

    // Read config from plugin's configResolved hook
    const pluginOpts = (vite.config as Record<string, any>).__moostViteOptions || {}
    const config = { ...pluginOpts, ...opts }

    const ssrEntry = config.ssrEntry as string | undefined
    const ssrOutlet = (config.ssrOutlet as string) || DEFAULT_SSR_OUTLET
    const ssrState = (config.ssrState as string) || DEFAULT_SSR_STATE

    if (!ssrEntry) {
      throw new Error(
        'createSSRServer: ssrEntry is required. Set it in moostVite() options or pass it directly.',
      )
    }

    const fs = await import('node:fs/promises')
    const path = await import('node:path')

    const ssrFallback: TMiddleware = async (req: any, res, next) => {
      if (req.method !== 'GET') return next()
      const url = req.originalUrl || req.url || '/'
      try {
        let template = await fs.readFile(path.resolve(process.cwd(), 'index.html'), 'utf-8')
        template = await vite.transformIndexHtml(url, template)
        const { render } = await vite.ssrLoadModule(ssrEntry)
        const { html: appHtml, state } = await render(url)
        res.statusCode = 200
        res.setHeader('Content-Type', 'text/html')
        res.end(
          template
            .replace(ssrOutlet, appHtml)
            .replace(ssrState, state ? `<script>window.__SSR_STATE__=${state}</script>` : ''),
        )
      } catch (e: any) {
        vite.ssrFixStacktrace(e)
        console.error(e)
        res.statusCode = 500
        res.end(e.message)
      }
    }

    return {
      use(mw) {
        userMiddlewares.push(mw)
      },
      async listen(_port) {
        for (const mw of userMiddlewares) {
          vite.middlewares.use(mw as any)
        }
        vite.middlewares.use(ssrFallback as any)
        await vite.listen()
        vite.printUrls()
      },
    }
  }

  // ─── PROD MODE ───
  // Config comes from __MOOST_* defines (baked in by plugin during build:app),
  // with user options as overrides.
  const fs = await import('node:fs/promises')
  const path = await import('node:path')
  const { createServer: createHttpServer } = await import('node:http')

  const clientDir = (opts.clientDir as string) || 'dist/client'
  const ssrOutlet = (opts.ssrOutlet as string) || (typeof __MOOST_SSR_OUTLET__ !== 'undefined' ? __MOOST_SSR_OUTLET__ : '<!--ssr-outlet-->')
  const ssrState = (opts.ssrState as string) || (typeof __MOOST_SSR_STATE__ !== 'undefined' ? __MOOST_SSR_STATE__ : '<!--ssr-state-->')
  let prefix = (opts.prefix as string) || __MOOST_PREFIX__
  if (!prefix.startsWith('/')) prefix = `/${prefix}`
  if (prefix.endsWith('/')) prefix = prefix.slice(0, -1)
  const prefixSlash = prefix + '/'
  const defaultPort = (opts.port as number) || Number(process.env.PORT) || 3000

  // Read HTML template once at startup
  const template = await fs.readFile(path.resolve(clientDir, 'index.html'), 'utf-8')

  // SSR render function (if ssrEntry is configured), otherwise SPA fallback
  let render: ((url: string) => Promise<{ html: string; state?: string }>) | null = null
  const hasSsr = typeof __MOOST_SSR_ENTRY__ !== 'undefined' && !!__MOOST_SSR_ENTRY__
  if (hasSsr) {
    // @ts-ignore dynamic import of built SSR entry
    const ssrModule = await import(/* @vite-ignore */ __MOOST_SSR_ENTRY__)
    render = ssrModule.render
  }

  // Patch MoostHttp.listen to capture the handler instead of binding a port
  const { MoostHttp, enableLocalFetch } = await import('@moostjs/event-http')
  let moostHandler: ((req: IncomingMessage, res: ServerResponse) => void) | null = null
  let moostHttpInstance: any = null
  const origListen = MoostHttp.prototype.listen
  MoostHttp.prototype.listen = function (...args: any[]) {
    moostHandler = this.getServerCb()
    moostHttpInstance = this
    setTimeout(() => args.filter((a: any) => typeof a === 'function').forEach((a: any) => a()), 1)
    return Promise.resolve()
  }

  // Import moost entry — __MOOST_ENTRY__ is replaced by define during build:app
  // e.g., becomes: await import("/src/main.ts") which rolldown bundles inline
  if (typeof opts.entry === 'function') {
    await opts.entry()
  } else if (typeof opts.entry === 'string') {
    await import(/* @vite-ignore */ opts.entry)
  } else {
    await import(__MOOST_ENTRY__)
  }

  // Restore original listen
  MoostHttp.prototype.listen = origListen

  // Enable local fetch for SSR — fetch('/api/...') calls moost handler in-process
  if (enableLocalFetch && moostHttpInstance) enableLocalFetch(moostHttpInstance)

  // Static file serving
  const sirv = (await import('sirv')).default
  const serve = sirv(path.resolve(clientDir), { extensions: [] })

  return {
    use(mw) {
      userMiddlewares.push(mw)
    },
    async listen(port) {
      const p = port || defaultPort
      createHttpServer((req, res) => {
        const url = req.url || '/'

        // 1. User middlewares (sequential)
        let i = 0
        const runNext = () => {
          if (i < userMiddlewares.length) {
            userMiddlewares[i++](req, res, runNext)
            return
          }

          // 2. API routes → moost
          if (moostHandler && (url.startsWith(prefixSlash) || url === prefix || url.startsWith(prefix + '?'))) {
            moostHandler(req, res)
            return
          }

          // 3. Static assets → sirv, then SSR render or SPA fallback
          serve(req, res, async () => {
            if (req.method !== 'GET') {
              res.statusCode = 404
              res.end()
              return
            }
            try {
              if (render) {
                const { html: appHtml, state } = await render(url)
                res.statusCode = 200
                res.setHeader('Content-Type', 'text/html')
                res.end(
                  template
                    .replace(ssrOutlet, appHtml)
                    .replace(
                      ssrState,
                      state ? `<script>window.__SSR_STATE__=${state}</script>` : '',
                    ),
                )
              } else {
                // SPA fallback — serve index.html for client-side routing
                res.statusCode = 200
                res.setHeader('Content-Type', 'text/html')
                res.end(template)
              }
            } catch (e: any) {
              console.error(e)
              res.statusCode = 500
              res.end(e.message)
            }
          })
        }
        runNext()
      }).listen(p, () => {
        console.log(`Server running at http://localhost:${p}`)
      })
    },
  }
}
