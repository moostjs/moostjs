import type { ServerResponse } from 'node:http'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { ViteDevServer } from 'vite'

import type { TConnectMiddleware } from './server-middleware'
import type { TSSRHttpContextRunner, TSSRMarkers, TSSRRender } from './utils'
import { renderSSRPage, sendSSRResponse } from './utils'

/** What the dev SSR page fallback renders with. */
export interface TDevSSRFallbackOptions {
  ssrEntry: string
  markers: Omit<TSSRMarkers, 'cspNonce'>
  /** The booted Moost HTTP adapter to render inside (`null` = SSR self-calls stay anonymous). */
  http: () => TSSRHttpContextRunner | null | undefined
  /**
   * Runs before each render: waits for a pending app reload; returns `true` when it answered
   * the request itself (the app failed to boot).
   */
  gate?: (res: ServerResponse) => Promise<boolean>
}

/**
 * The dev server's SSR page fallback (registered after Vite's own middlewares): renders GET
 * requests nobody answered with the SSR entry, through Vite's `transformIndexHtml`.
 */
export function devSSRFallback(
  server: ViteDevServer,
  options: TDevSSRFallbackOptions,
): TConnectMiddleware {
  return async (req, res, next) => {
    if (req.method !== 'GET') {
      next()
      return
    }
    const url = (req as { originalUrl?: string }).originalUrl || req.url || '/'
    try {
      if (await options.gate?.(res)) {
        return
      }
      const source = await readFile(resolve(server.config.root, 'index.html'), 'utf8')
      const template = await server.transformIndexHtml(url, source)
      const { render } = await server.ssrLoadModule(options.ssrEntry)
      const result = await renderSSRPage({
        render: render as TSSRRender,
        url,
        req,
        res,
        http: options.http(),
      })
      const cspNonce = server.config.html?.cspNonce
      sendSSRResponse(res, template, { ...options.markers, cspNonce }, result)
    } catch (error) {
      if (error instanceof Error) {
        server.ssrFixStacktrace(error)
      }
      console.error(error)
      res.statusCode = 500
      res.end((error as Error | undefined)?.message)
    }
  }
}
