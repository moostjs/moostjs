import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import type { IncomingHttpHeaders } from 'node:http'
import { get as httpGet } from 'node:http'
import type { AddressInfo, Server } from 'node:net'
import { createServer as createNetServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { brotliDecompressSync, gunzipSync } from 'node:zlib'
import { MoostHttp } from '@moostjs/event-http'
import type { Plugin } from 'vite'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { moostVite } from '../src/moost-vite'
import type { TMoostViteDevOptions } from '../src/moost-vite'
import { precompressDir } from '../src/precompress'
import { createSSRServer } from '../src/prod-server'
import type { TSSRServerOptions } from '../src/prod-server'

/**
 * Drives the PRODUCTION branch of createSSRServer: the build-time defines the
 * plugin bakes into `build:app` are stubbed as globals, and the entry only
 * calls `MoostHttp.listen()` (captured by the server, never binds itself).
 */
/** Every build-time define the generated production server reads. */
const DEFINES = [
  ...new Set(
    readFileSync(fileURLToPath(new URL('../src/prod-server.ts', import.meta.url)), 'utf8').match(
      /__MOOST_[A-Z_]+__/g,
    ),
  ),
]

const g = globalThis as Record<string, unknown>
const clientDir = mkdtempSync(join(tmpdir(), 'moost-prod-server-'))
writeFileSync(join(clientDir, 'index.html'), '<html>SPA_SHELL</html>')

const started: Server[] = []
const logs: string[] = []

beforeAll(() => {
  process.env.MOOST_DEFERRED_ENV = 'production'
  for (const name of DEFINES) {
    g[name] = undefined
  }
  vi.spyOn(console, 'log').mockImplementation((msg: string) => void logs.push(msg))
})

afterEach(async () => {
  delete process.env.HOST
  logs.length = 0
  await Promise.all(started.splice(0).map((server) => close(server)))
})

afterAll(() => {
  delete process.env.MOOST_DEFERRED_ENV
  for (const name of DEFINES) {
    delete g[name]
  }
  vi.restoreAllMocks()
  rmSync(clientDir, { recursive: true, force: true })
})

const address = (server: Server) => server.address() as AddressInfo
const close = (server: Server) => new Promise((resolve) => server.close(resolve))

/** A port that was free a moment ago (bound to loopback, then released). */
async function freePort() {
  const probe = createNetServer()
  await new Promise<void>((resolve) => probe.listen(0, '127.0.0.1', resolve))
  const { port } = address(probe)
  await close(probe)
  return port
}

async function start(options: { host?: string; port?: number }, ...args: [number?, string?]) {
  const app = await createSSRServer({
    clientDir,
    entry: () => new MoostHttp().listen(),
    ...options,
  })
  const server = await app.listen(...args)
  started.push(server)
  return server
}

describe('createSSRServer (production) — bind address', () => {
  it('binds the `host` option and logs the address it actually bound', async () => {
    const server = await start({ host: '127.0.0.1', port: await freePort() })

    const { address: bound, port } = address(server)
    expect(bound).toBe('127.0.0.1')
    expect(logs).toContain(`Server running at http://127.0.0.1:${port}`)
    // Served: the no-match Moost request falls through to the SPA shell.
    const res = await fetch(`http://127.0.0.1:${port}/`)
    expect(await res.text()).toContain('SPA_SHELL')
  })

  it('defaults the host to process.env.HOST', async () => {
    process.env.HOST = '127.0.0.1'
    const server = await start({ port: await freePort() })
    expect(address(server).address).toBe('127.0.0.1')
  })

  it('lets listen(port, host) override the options', async () => {
    const port = await freePort()
    const server = await start({ host: '0.0.0.0', port: 1 }, port, '127.0.0.1')
    expect(address(server)).toMatchObject({ address: '127.0.0.1', port })
  })

  it('rejects listen() on a bind error instead of emitting an unhandled error', async () => {
    const blocker = createNetServer()
    await new Promise<void>((resolve) => blocker.listen(0, '127.0.0.1', resolve))
    try {
      const app = await createSSRServer({ clientDir, entry: () => new MoostHttp().listen() })
      await expect(app.listen(address(blocker).port, '127.0.0.1')).rejects.toMatchObject({
        code: 'EADDRINUSE',
      })
      expect(logs.some((l) => l.startsWith('Server running'))).toBe(false)
    } finally {
      await close(blocker)
    }
  })
})

/** The `define` map the middleware-mode `vite build` bakes into the SSR environment. */
function serverDefines(
  options: Partial<TMoostViteDevOptions> = {},
  userConfig: Record<string, unknown> = {},
): Record<string, string> {
  const [plugin] = moostVite({ entry: './src/main.ts', middleware: true, ...options }) as Plugin[]
  const config = (plugin.config as Function)(
    { root: clientDir, ...userConfig },
    { command: 'build', mode: 'production' },
  )
  return config.environments.ssr.define
}

describe('createSSRServer (production) — build-time defines', () => {
  it('bakes every define the prod server reads, SSR or not', () => {
    expect(DEFINES).toContain('__MOOST_SSR_OUTLET__')
    for (const options of [{}, { ssrEntry: '/src/entry-server.ts' }]) {
      expect(Object.keys(serverDefines(options))).toEqual(expect.arrayContaining(DEFINES))
    }
    expect(serverDefines().__MOOST_SSR_ENTRY__).toBe('undefined')
    expect(serverDefines({ ssrEntry: '/src/entry-server.ts' }).__MOOST_SSR_ENTRY__).toBe(
      JSON.stringify('./ssr/entry-server.js'),
    )
  })

  it('bakes the precompress and cache-control policies', () => {
    const baked = (options: Partial<TMoostViteDevOptions>, userConfig = {}) => {
      const defines = serverDefines(options, userConfig)
      return {
        precompress: JSON.parse(defines.__MOOST_PRECOMPRESS__),
        cacheControl: JSON.parse(defines.__MOOST_CACHE_CONTROL__),
      }
    }
    expect(baked({})).toEqual({
      precompress: { brotli: true, gzip: true },
      cacheControl: { assetsDir: 'assets' },
    })
    expect(baked({ precompress: false, cacheControl: false })).toEqual({
      precompress: false,
      cacheControl: false,
    })
    expect(baked({ precompress: { gzip: false }, cacheControl: { html: 'no-store' } })).toEqual({
      precompress: { brotli: true, gzip: false },
      cacheControl: { html: 'no-store', assetsDir: 'assets' },
    })
    // the hashed dir follows the client build.assetsDir unless set explicitly
    expect(baked({}, { build: { assetsDir: 'static' } }).cacheControl.assetsDir).toBe('static')
    expect(
      baked({}, { environments: { client: { build: { assetsDir: '_app' } } } }).cacheControl
        .assetsDir,
    ).toBe('_app')
    expect(
      baked({ cacheControl: { assetsDir: 'hashed' } }, { build: { assetsDir: 'static' } })
        .cacheControl.assetsDir,
    ).toBe('hashed')
  })

  it('starts a client-only server with exactly the baked defines', async () => {
    // up to 0.6.40 the SSR placeholders were baked only with `ssrEntry`:
    // ReferenceError: __MOOST_SSR_OUTLET__ is not defined
    const baked = serverDefines()
    try {
      for (const name of DEFINES) {
        delete g[name]
        if (name in baked) {
          g[name] = new Function(`return ${baked[name]}`)()
        }
      }
      const server = await start({ port: await freePort() })
      const res = await fetch(`http://127.0.0.1:${address(server).port}/`)
      expect(await res.text()).toContain('SPA_SHELL')
    } finally {
      for (const name of DEFINES) {
        g[name] = undefined
      }
    }
  })
})

// ─── Static files: precompressed variants, cache headers, index.html ───

const BIG_JS = 'export const answer = 42 // compressible\n'.repeat(200)
const SPA_TEMPLATE = `<html><body>${'<p>SPA_SHELL</p>'.repeat(100)}</body></html>`
const SSR_TEMPLATE = '<html><head><!--ssr-head--></head><body><!--ssr-outlet--></body></html>'

/** A built client dir (+ precompressed siblings) with the given index.html. */
async function makeStaticDir(indexHtml: string): Promise<string> {
  const dir = mkdtempSync(join(tmpdir(), 'moost-prod-static-'))
  mkdirSync(join(dir, 'assets'))
  writeFileSync(join(dir, 'index.html'), indexHtml)
  writeFileSync(join(dir, 'assets/app-abc123.js'), BIG_JS)
  writeFileSync(join(dir, 'robots.txt'), 'User-agent: *\n')
  await precompressDir(dir)
  return dir
}

interface TRawResponse {
  status: number
  headers: IncomingHttpHeaders
  body: Buffer
}

/** Raw GET (no automatic decompression, unlike fetch; no keep-alive to hold up close()). */
function get(
  server: Server,
  path: string,
  headers: Record<string, string> = {},
): Promise<TRawResponse> {
  return new Promise((resolve, reject) => {
    const { port } = address(server)
    httpGet({ host: '127.0.0.1', port, path, headers, agent: false }, (res) => {
      const chunks: Buffer[] = []
      res.on('data', (chunk: Buffer) => chunks.push(chunk))
      res.on('end', () =>
        resolve({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks) }),
      )
    }).on('error', reject)
  })
}

function decode(res: TRawResponse): string {
  const encoding = res.headers['content-encoding']
  const body =
    encoding === 'br'
      ? brotliDecompressSync(res.body)
      : encoding === 'gzip'
        ? gunzipSync(res.body)
        : res.body
  return body.toString('utf8')
}

describe('createSSRServer (production) — static files', () => {
  let dir: string
  beforeAll(async () => {
    dir = await makeStaticDir(SPA_TEMPLATE)
  })
  afterAll(() => rmSync(dir, { recursive: true, force: true }))

  const startStatic = async (options: Partial<TSSRServerOptions> = {}) =>
    start({ port: await freePort(), clientDir: dir, ...options } as { port: number })

  it('negotiates the precompressed variants (br, gzip, identity) with Vary', async () => {
    const server = await startStatic()
    for (const [accept, encoding] of [
      ['gzip, deflate, br', 'br'],
      ['gzip', 'gzip'],
      ['identity', undefined],
    ] as const) {
      const res = await get(server, '/assets/app-abc123.js', { 'accept-encoding': accept })
      expect(res.status).toBe(200)
      expect(res.headers['content-encoding']).toBe(encoding)
      expect(res.headers.vary).toBe('Accept-Encoding')
      expect(res.headers['content-type']).toContain('javascript')
      expect(decode(res)).toBe(BIG_JS)
    }
  })

  it('caches hashed assets as immutable, revalidates everything else', async () => {
    const server = await startStatic()
    const asset = await get(server, '/assets/app-abc123.js')
    expect(asset.headers['cache-control']).toBe('public, max-age=31536000, immutable')

    const file = await get(server, '/robots.txt')
    expect(file.headers['cache-control']).toBe('no-cache')
    expect(file.headers.etag).toBeTruthy()

    // ETag revalidation: 304 still carries Cache-Control and Vary.
    const revalidated = await get(server, '/robots.txt', {
      'if-none-match': String(file.headers.etag),
    })
    expect(revalidated.status).toBe(304)
    expect(revalidated.headers['cache-control']).toBe('no-cache')
    expect(revalidated.headers.vary).toBe('Accept-Encoding')

    // A miss under /assets/ falls through to the page: never marked immutable.
    const missing = await get(server, '/assets/missing-000.js')
    expect(missing.headers['cache-control']).toBe('no-cache')
    expect(decode(missing)).toBe(SPA_TEMPLATE)
  })

  it('serves the SPA fallback as no-cache, precompressed when accepted', async () => {
    const server = await startStatic()
    const res = await get(server, '/some/client/route', { 'accept-encoding': 'br' })
    expect(res.status).toBe(200)
    expect(res.headers['cache-control']).toBe('no-cache')
    expect(res.headers['content-encoding']).toBe('br')
    expect(res.headers.vary).toBe('Accept-Encoding')
    expect(decode(res)).toBe(SPA_TEMPLATE)

    const plain = await get(server, '/some/client/route')
    expect(plain.headers['content-encoding']).toBeUndefined()
    expect(plain.body.toString()).toBe(SPA_TEMPLATE)
  })

  it('routes /index.html (and its variants) to the page fallback', async () => {
    const server = await startStatic()
    // sirv drops one trailing slash before its lookup: `/index.html/` is the file too
    for (const path of ['/index.html', '/index.html?x=1', '/index.html.br', '/index.html/']) {
      const res = await get(server, path, { 'accept-encoding': 'gzip' })
      expect({
        path,
        status: res.status,
        etag: res.headers.etag, // no ETag: served by the fallback, not sirv
        cacheControl: res.headers['cache-control'],
        body: decode(res),
      }).toEqual({
        path,
        status: 200,
        etag: undefined,
        cacheControl: 'no-cache',
        body: SPA_TEMPLATE,
      })
    }
  })

  it('keeps a Cache-Control set by a user middleware', async () => {
    const app = await createSSRServer({
      clientDir: dir,
      entry: () => new MoostHttp().listen(),
    })
    app.use((_req, res, next) => {
      res.setHeader('Cache-Control', 'private, max-age=5')
      next()
    })
    const server = await app.listen(await freePort(), '127.0.0.1')
    started.push(server)
    for (const path of ['/assets/app-abc123.js', '/robots.txt', '/client/route']) {
      const res = await get(server, path)
      expect({ path, cacheControl: res.headers['cache-control'] }).toEqual({
        path,
        cacheControl: 'private, max-age=5',
      })
    }
  })

  it('merges Accept-Encoding into a Vary set by a user middleware', async () => {
    const app = await createSSRServer({
      clientDir: dir,
      entry: () => new MoostHttp().listen(),
    })
    app.use((_req, res, next) => {
      res.setHeader('Vary', 'Origin')
      next()
    })
    const server = await app.listen(await freePort(), '127.0.0.1')
    started.push(server)
    const asset = await get(server, '/assets/app-abc123.js', { 'accept-encoding': 'br' })
    expect(asset.headers['content-encoding']).toBe('br')
    expect(asset.headers.vary).toBe('Origin, Accept-Encoding')
    const revalidated = await get(server, '/assets/app-abc123.js', {
      'accept-encoding': 'br',
      'if-none-match': String(asset.headers.etag),
    })
    expect(revalidated.status).toBe(304)
    expect(revalidated.headers.vary).toBe('Origin, Accept-Encoding')
    const page = await get(server, '/client/route', { 'accept-encoding': 'gzip' })
    expect(page.headers.vary).toBe('Origin, Accept-Encoding')
    expect(decode(page)).toBe(SPA_TEMPLATE)
  })

  it('marks nothing immutable when the assets directory is the build root', async () => {
    const server = await startStatic({ cacheControl: { assetsDir: '' } })
    for (const path of ['/assets/app-abc123.js', '/robots.txt']) {
      const res = await get(server, path)
      expect({ path, cacheControl: res.headers['cache-control'] }).toEqual({
        path,
        cacheControl: 'no-cache',
      })
    }
  })

  it('opts out: precompressed false, cacheControl false', async () => {
    const server = await startStatic({ precompressed: false, cacheControl: false })
    const res = await get(server, '/assets/app-abc123.js', { 'accept-encoding': 'br, gzip' })
    expect(res.headers['content-encoding']).toBeUndefined()
    expect(res.headers.vary).toBeUndefined()
    expect(res.headers['cache-control']).toBeUndefined()
    expect(res.body.toString()).toBe(BIG_JS)
    const page = await get(server, '/client/route', { 'accept-encoding': 'br, gzip' })
    expect(page.headers['content-encoding']).toBeUndefined()
    expect(page.headers['cache-control']).toBeUndefined()
  })

  it('overrides per class and per baked option', async () => {
    g.__MOOST_CACHE_CONTROL__ = { assetsDir: 'static', html: 'no-store' }
    g.__MOOST_PRECOMPRESS__ = { brotli: false, gzip: true }
    try {
      const server = await startStatic({ cacheControl: { files: 'public, max-age=60' } })
      // `assets/` is not the baked hashed dir any more → a plain file
      const asset = await get(server, '/assets/app-abc123.js', { 'accept-encoding': 'br, gzip' })
      expect(asset.headers['cache-control']).toBe('public, max-age=60')
      expect(asset.headers['content-encoding']).toBe('gzip')
      const page = await get(server, '/client/route')
      expect(page.headers['cache-control']).toBe('no-store')
    } finally {
      g.__MOOST_CACHE_CONTROL__ = undefined
      g.__MOOST_PRECOMPRESS__ = undefined
    }
  })
})

describe('createSSRServer (production) — SSR pages', () => {
  let dir: string
  let ssrEntry: string
  beforeAll(async () => {
    dir = await makeStaticDir(SSR_TEMPLATE)
    ssrEntry = join(dir, 'entry-server.mjs')
    writeFileSync(
      ssrEntry,
      `export function render(url) {
        return url.startsWith('/cached')
          ? { html: 'CACHED', headers: { 'cache-control': 'public, max-age=60' } }
          : { html: 'RENDERED ' + url }
      }`,
    )
    g.__MOOST_SSR_ENTRY__ = pathToFileURL(ssrEntry).href
  })
  afterAll(() => {
    g.__MOOST_SSR_ENTRY__ = undefined
    rmSync(dir, { recursive: true, force: true })
  })

  const startSsr = async () => start({ port: await freePort(), clientDir: dir } as { port: number })

  it('renders /index.html instead of leaking the raw template', async () => {
    const server = await startSsr()
    for (const path of ['/index.html', '/index.html.gz', '/index.html/']) {
      const res = await get(server, path, { 'accept-encoding': 'gzip' })
      // rendered for the requested url, placeholders filled
      expect(decode(res)).toBe(`<html><head></head><body>RENDERED ${path}</body></html>`)
    }
  })

  it('sends SSR pages as no-cache unless the render sets Cache-Control', async () => {
    const server = await startSsr()
    const page = await get(server, '/page')
    expect(page.body.toString()).toContain('RENDERED /page')
    expect(page.headers['cache-control']).toBe('no-cache')
    expect(page.headers['content-encoding']).toBeUndefined()

    const cached = await get(server, '/cached')
    expect(cached.headers['cache-control']).toBe('public, max-age=60')

    // static assets are still served (and cached) next to SSR
    const asset = await get(server, '/assets/app-abc123.js', { 'accept-encoding': 'br' })
    expect(asset.headers['content-encoding']).toBe('br')
    expect(asset.headers['cache-control']).toBe('public, max-age=31536000, immutable')
  })
})
