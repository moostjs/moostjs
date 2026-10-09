import { readFile } from 'node:fs/promises'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { join } from 'node:path'

/**
 * `Cache-Control` policy of the generated production server. Each value is a
 * full `Cache-Control` header value; `false` sends no `Cache-Control` for that
 * class of responses. A `Cache-Control` already set on the response (by a user
 * middleware, the app or the SSR render's `headers`) is never overridden.
 */
export interface TCacheControlOptions {
  /**
   * Files under the hashed assets directory (`/<assetsDir>/…`). Vite puts a
   * content hash in every file name there, so they never change.
   * Default: `'public, max-age=31536000, immutable'`.
   */
  assets?: string | false
  /**
   * The hashed assets directory, relative to the client build root.
   * Default: the client `build.assetsDir` (`'assets'`). An empty value (assets
   * emitted at the build root) leaves no file in the `assets` class: hashed and
   * unhashed files cannot be told apart there, so all of them get `files`.
   */
  assetsDir?: string
  /**
   * Every other static file (files copied from `public/`, `favicon.ico`, …).
   * Revalidated through the `ETag`. Default: `'no-cache'`.
   */
  files?: string | false
  /** HTML pages: the SPA fallback and SSR-rendered pages. Default: `'no-cache'`. */
  html?: string | false
}

/** Precompressed sibling variants the production server negotiates. */
export interface TPrecompressedOptions {
  /** Serve `<file>.br` to clients that accept brotli. Default: `true`. */
  brotli?: boolean
  /** Serve `<file>.gz` to clients that accept gzip. Default: `true`. */
  gzip?: boolean
}

export const DEFAULT_ASSETS_CACHE_CONTROL = 'public, max-age=31536000, immutable'
export const DEFAULT_REVALIDATE_CACHE_CONTROL = 'no-cache'

/** Resolved {@link TCacheControlOptions}: every field set, `assetsDir` as a URL prefix. */
export interface TResolvedCacheControl {
  assets: string | false
  /** e.g. `'/assets/'`; `null` when the assets directory is the build root. */
  assetsPrefix: string | null
  files: string | false
  html: string | false
}

/**
 * Resolves the cache policy from the build-time value and a runtime override:
 * an override object is merged over the baked object (or the defaults when the
 * build disabled it), `true` keeps the baked policy, `false` disables it.
 */
export function resolveCacheControl(
  baked: TCacheControlOptions | false | undefined,
  override: boolean | TCacheControlOptions | undefined,
): TResolvedCacheControl | null {
  if (override === false || (override === undefined && baked === false)) {
    return null
  }
  const opts: TCacheControlOptions = {
    ...(baked || undefined),
    ...(typeof override === 'object' ? override : undefined),
  }
  const assetsDir = (opts.assetsDir ?? 'assets').replace(/^\/+|\/+$/g, '')
  return {
    assets: opts.assets ?? DEFAULT_ASSETS_CACHE_CONTROL,
    assetsPrefix: assetsDir ? `/${assetsDir}/` : null,
    files: opts.files ?? DEFAULT_REVALIDATE_CACHE_CONTROL,
    html: opts.html ?? DEFAULT_REVALIDATE_CACHE_CONTROL,
  }
}

/** Resolves which precompressed variants to serve (build-time value + runtime override). */
export function resolvePrecompressed(
  baked: TPrecompressedOptions | false | undefined,
  override: boolean | TPrecompressedOptions | undefined,
): { brotli: boolean; gzip: boolean } {
  const opts = override ?? baked ?? true
  if (typeof opts === 'boolean') {
    return { brotli: opts, gzip: opts }
  }
  return { brotli: opts.brotli !== false, gzip: opts.gzip !== false }
}

/** The decoded pathname of a request url, the way sirv looks files up. */
function requestPathname(url: string): string {
  const end = url.search(/[?#]/)
  const pathname = end === -1 ? url : url.slice(0, end)
  if (!pathname.includes('%')) {
    return pathname
  }
  try {
    return decodeURI(pathname)
  } catch {
    return pathname
  }
}

/**
 * The root `index.html` (and precompressed siblings) is the SPA/SSR template:
 * it is never served as a static file, but by the SPA/SSR fallback (in SSR mode
 * a raw template would leak its unfilled `<!--ssr-outlet-->` placeholders).
 * sirv drops one trailing slash before its lookup, so `/index.html/` matches too.
 */
function isIndexTemplatePath(pathname: string): boolean {
  return /^\/index\.html(?:\.br|\.gz)?\/?$/.test(pathname)
}

/**
 * Sets a header unless the response already carries it. Returns a restore
 * callback that removes it again only if it still holds the value set here.
 */
export function presetHeader(res: ServerResponse, name: string, value: string): () => void {
  if (res.hasHeader(name)) {
    return () => {}
  }
  res.setHeader(name, value)
  return () => {
    if (res.getHeader(name) === value) {
      res.removeHeader(name)
    }
  }
}

/**
 * Adds `Accept-Encoding` to the response's `Vary`, keeping the tokens already
 * there. Returns a restore callback that puts the previous value back.
 */
function varyAcceptEncoding(res: ServerResponse): () => void {
  const prev = res.getHeader('Vary')
  if (prev !== undefined && /(?:^|,)\s*(?:\*|accept-encoding)\s*(?:,|$)/i.test(String(prev))) {
    return () => {}
  }
  const next = prev === undefined ? 'Accept-Encoding' : `${String(prev)}, Accept-Encoding`
  res.setHeader('Vary', next)
  return () => {
    if (res.getHeader('Vary') === next) {
      if (prev === undefined) {
        res.removeHeader('Vary')
      } else {
        res.setHeader('Vary', prev)
      }
    }
  }
}

/** The SPA shell (`index.html`) with the precompressed siblings the build wrote for it. */
export interface TSpaShell {
  html: string
  br?: Buffer
  gzip?: Buffer
}

/** Reads the precompressed siblings of the SPA shell (`index.html.br` / `.gz`), when enabled. */
export async function loadSpaShell(
  clientDir: string,
  html: string,
  variants: { brotli: boolean; gzip: boolean },
): Promise<TSpaShell> {
  const read = (enabled: boolean, ext: string) =>
    enabled ? readFile(join(clientDir, `index.html${ext}`)).catch(() => undefined) : undefined
  const [br, gzip] = await Promise.all([read(variants.brotli, '.br'), read(variants.gzip, '.gz')])
  return { html, br, gzip }
}

/** Sends the SPA shell for client-side routing, precompressed when the client accepts it. */
export function sendSpaShell(
  req: IncomingMessage,
  res: ServerResponse,
  shell: TSpaShell,
  cache: TResolvedCacheControl | null,
): void {
  res.statusCode = 200
  res.setHeader('Content-Type', 'text/html')
  if (cache?.html) {
    presetHeader(res, 'Cache-Control', cache.html)
  }
  let body: string | Buffer = shell.html
  if (shell.br || shell.gzip) {
    varyAcceptEncoding(res)
    // Mirrors sirv's negotiation: brotli first, then gzip.
    const accept = req.headers['accept-encoding'] || ''
    const variant =
      shell.br && /\b(?:br|brotli)\b/i.test(accept)
        ? { encoding: 'br', data: shell.br }
        : shell.gzip && /\bgzip\b/i.test(accept)
          ? { encoding: 'gzip', data: shell.gzip }
          : undefined
    if (variant) {
      res.setHeader('Content-Encoding', variant.encoding)
      body = variant.data
    }
  }
  res.end(body)
}

type THandler = (req: IncomingMessage, res: ServerResponse) => void

/**
 * Static file serving (sirv) with the cache policy and the precompressed
 * variants; requests that match no file — and the root `index.html` template —
 * go to `servePage` (SSR render or SPA shell).
 */
export async function createStaticHandler(
  clientDir: string,
  variants: { brotli: boolean; gzip: boolean },
  cache: TResolvedCacheControl | null,
  servePage: THandler,
): Promise<THandler> {
  const { default: sirv } = await import('sirv')
  const negotiate = variants.brotli || variants.gzip
  /** The `Vary` each response should carry: sirv overwrites it with a bare `Accept-Encoding`. */
  const varyOf = new WeakMap<ServerResponse, string>()
  // ETags make `no-cache` files revalidate with a 304.
  const serve = sirv(clientDir, {
    extensions: [],
    etag: true,
    brotli: variants.brotli,
    gzip: variants.gzip,
    setHeaders: (res) => {
      const vary = varyOf.get(res)
      if (vary) {
        res.setHeader('Vary', vary)
      }
    },
  })

  return (req, res) => {
    const pathname = requestPathname(req.url || '/')
    if (isIndexTemplatePath(pathname)) {
      servePage(req, res)
      return
    }
    // Preset (not via sirv's setHeaders) so the 304 sirv answers on an ETag
    // match carries them too; restored when sirv falls through to the page.
    const restore: (() => void)[] = []
    const cacheControl =
      cache &&
      (cache.assetsPrefix && pathname.startsWith(cache.assetsPrefix) ? cache.assets : cache.files)
    if (cacheControl) {
      restore.push(presetHeader(res, 'Cache-Control', cacheControl))
    }
    if (negotiate) {
      restore.push(varyAcceptEncoding(res))
      varyOf.set(res, String(res.getHeader('Vary')))
    }
    serve(req, res, () => {
      for (const undo of restore) {
        undo()
      }
      servePage(req, res)
    })
  }
}
