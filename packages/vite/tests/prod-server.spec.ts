import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import type { IncomingHttpHeaders } from 'node:http'
import { get as httpGet } from 'node:http'
import type { AddressInfo, Server } from 'node:net'
import { createServer as createNetServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { brotliDecompressSync, gunzipSync } from 'node:zlib'
import { Get, MoostHttp, SetHeader } from '@moostjs/event-http'
import { clearGlobalWooks, Controller, Moost } from 'moost'
import type { Plugin } from 'vite'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

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

// each test's app gets its own router: tests re-register the same routes (`bootRoutes()`)
beforeEach(() => {
  clearGlobalWooks()
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

// ─── `prefix` = API mount: unmatched routes under it answer Moost's 404 ───

describe('createSSRServer (production) — prefix is an API mount', () => {
  it('answers an unmatched route under the prefix with the JSON 404, not the SPA shell', async () => {
    const server = await start({ host: '127.0.0.1', port: await freePort(), prefix: '/api' })
    const base = `http://127.0.0.1:${address(server).port}`

    const missing = await fetch(`${base}/api/no-such-route`)
    expect(missing.status).toBe(404)
    expect(missing.headers.get('content-type')).toContain('application/json')
    expect(await missing.json()).toMatchObject({ statusCode: 404 })

    // the mount itself is under the prefix too
    const mount = await fetch(`${base}/api`)
    expect(mount.status).toBe(404)

    // outside the mount: the SPA fallback is unchanged
    const page = await fetch(`${base}/some/client/route`)
    expect(page.status).toBe(200)
    expect(await page.text()).toContain('SPA_SHELL')
  })

  it('serves a static file under a prefix mount (GET and HEAD), the JSON 404 for a missing one', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'moost-prod-mount-'))
    try {
      writeFileSync(join(dir, 'index.html'), '<html>SPA_SHELL</html>')
      mkdirSync(join(dir, '.well-known'))
      writeFileSync(join(dir, '.well-known', 'security.txt'), 'Contact: mailto:sec@example.com')
      const app = await createSSRServer({
        clientDir: dir,
        entry: () => new MoostHttp().listen(),
        prefix: ['/api', '/.well-known'],
      })
      const server = await app.listen(await freePort(), '127.0.0.1')
      started.push(server)
      const base = `http://127.0.0.1:${address(server).port}`

      const file = await fetch(`${base}/.well-known/security.txt`)
      expect(file.status).toBe(200)
      expect(await file.text()).toBe('Contact: mailto:sec@example.com')

      const head = await fetch(`${base}/.well-known/security.txt`, { method: 'HEAD' })
      expect(head.status).toBe(200)

      const missing = await fetch(`${base}/.well-known/missing.txt`)
      expect(missing.status).toBe(404)
      expect(await missing.json()).toMatchObject({ statusCode: 404 })

      // only GET/HEAD read static files; other methods get the 404 straight away
      const post = await fetch(`${base}/.well-known/security.txt`, { method: 'POST' })
      expect(post.status).toBe(404)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('opts out with prefixFallthrough: unmatched routes under the prefix reach the SPA fallback', async () => {
    const server = await start({
      host: '127.0.0.1',
      port: await freePort(),
      prefix: '/api',
      prefixFallthrough: true,
    })
    const res = await fetch(`http://127.0.0.1:${address(server).port}/api/no-such-route`)
    expect(res.status).toBe(200)
    expect(await res.text()).toContain('SPA_SHELL')
  })

  it('bakes prefixFallthrough into the generated server', () => {
    expect(serverDefines({ prefix: '/api' }).__MOOST_PREFIX_FALLTHROUGH__).toBe('false')
    expect(
      serverDefines({ prefix: '/api', prefixFallthrough: true }).__MOOST_PREFIX_FALLTHROUGH__,
    ).toBe('true')
  })
})

// ─── `headers` option: set first on every response ───

@Controller('api')
class HeadersRouteController {
  @Get('plain')
  plain() {
    return 'plain'
  }

  @Get('own')
  @SetHeader('x-shared', 'route')
  own() {
    return 'own'
  }
}

/** A Moost app with routes; its `listen()` is captured by the server. */
async function bootRoutes() {
  const app = new Moost()
  const http = new MoostHttp()
  app.adapter(http)
  app.registerControllers(HeadersRouteController)
  await app.init()
  await http.listen()
}

describe('createSSRServer (production) — headers option', () => {
  const HEADERS = { 'x-frame-options': 'DENY', 'x-shared': 'base' }
  let spaDir: string
  let ssrDir: string
  beforeAll(async () => {
    spaDir = await makeStaticDir(SPA_TEMPLATE)
    ssrDir = await makeStaticDir(SSR_TEMPLATE)
    writeFileSync(
      join(ssrDir, 'entry-server.mjs'),
      `export function render(url) {
        return url === '/own' ? { html: 'OWN', headers: { 'x-shared': 'render' } } : { html: 'PAGE' }
      }`,
    )
  })
  afterAll(() => {
    rmSync(spaDir, { recursive: true, force: true })
    rmSync(ssrDir, { recursive: true, force: true })
  })

  it('bakes the headers option', () => {
    expect(JSON.parse(serverDefines().__MOOST_HEADERS__)).toBeNull()
    expect(JSON.parse(serverDefines({ headers: HEADERS }).__MOOST_HEADERS__)).toEqual(HEADERS)
  })

  it('sets them on Moost routes, the SPA shell and static files; routes and middlewares replace them', async () => {
    const app = await createSSRServer({ clientDir: spaDir, headers: HEADERS, entry: bootRoutes })
    app.use((req, res, next) => {
      if (req.url === '/robots.txt') {
        res.setHeader('x-shared', 'middleware')
      }
      next()
    })
    const server = await app.listen(await freePort(), '127.0.0.1')
    started.push(server)

    const route = await get(server, '/api/plain')
    expect(route.body.toString()).toBe('plain')
    expect(route.headers).toMatchObject(HEADERS)
    const own = await get(server, '/api/own')
    expect(own.headers).toMatchObject({ 'x-frame-options': 'DENY', 'x-shared': 'route' })

    const shell = await get(server, '/some/page', { 'accept-encoding': 'br' })
    expect(decode(shell)).toContain('SPA_SHELL')
    expect(shell.headers).toMatchObject(HEADERS)

    const asset = await get(server, '/assets/app-abc123.js')
    expect(asset.headers).toMatchObject(HEADERS)
    expect(asset.headers['cache-control']).toBe('public, max-age=31536000, immutable')

    const robots = await get(server, '/robots.txt')
    expect(robots.headers).toMatchObject({ 'x-frame-options': 'DENY', 'x-shared': 'middleware' })
  })

  it("sets them on SSR pages; the render result's headers replace them", async () => {
    g.__MOOST_SSR_ENTRY__ = pathToFileURL(join(ssrDir, 'entry-server.mjs')).href
    try {
      const server = await start({ port: await freePort(), clientDir: ssrDir, headers: HEADERS })
      const page = await get(server, '/page')
      expect(page.body.toString()).toContain('PAGE')
      expect(page.headers).toMatchObject(HEADERS)
      const own = await get(server, '/own')
      expect(own.headers).toMatchObject({ 'x-frame-options': 'DENY', 'x-shared': 'render' })
    } finally {
      g.__MOOST_SSR_ENTRY__ = undefined
    }
  })

  it('uses the baked headers; createSSRServer({ headers }) replaces the whole set', async () => {
    g.__MOOST_HEADERS__ = { 'x-baked': '1', 'x-frame-options': 'SAMEORIGIN' }
    try {
      const baked = await start({ port: await freePort(), clientDir: spaDir })
      const bakedRes = await get(baked, '/')
      expect(bakedRes.headers).toMatchObject({ 'x-baked': '1', 'x-frame-options': 'SAMEORIGIN' })
      const replaced = await start({
        port: await freePort(),
        clientDir: spaDir,
        headers: { 'x-frame-options': 'DENY' },
      })
      const res = await get(replaced, '/')
      expect(res.headers['x-frame-options']).toBe('DENY')
      expect(res.headers['x-baked']).toBeUndefined()
    } finally {
      g.__MOOST_HEADERS__ = undefined
    }
  })

  it('merges a Vary among them with the precompressed variants, also on a 304', async () => {
    const server = await start({
      port: await freePort(),
      clientDir: spaDir,
      headers: { vary: 'Origin' },
    })
    const asset = await get(server, '/assets/app-abc123.js', { 'accept-encoding': 'br' })
    expect(asset.headers['content-encoding']).toBe('br')
    expect(asset.headers.vary).toBe('Origin, Accept-Encoding')
    const revalidated = await get(server, '/assets/app-abc123.js', {
      'accept-encoding': 'br',
      'if-none-match': String(asset.headers.etag),
    })
    expect(revalidated.status).toBe(304)
    expect(revalidated.headers.vary).toBe('Origin, Accept-Encoding')
  })

  it('rejects an invalid header name or value at startup, naming the header', async () => {
    await expect(
      createSSRServer({ clientDir: spaDir, headers: { 'x-split': 'a\r\nset-cookie: x=1' } }),
    ).rejects.toThrow(/createSSRServer\(\{ headers \}\): invalid header "x-split"/)
    expect(() =>
      moostVite({ entry: './src/main.ts', middleware: true, headers: { 'bad name': '1' } }),
    ).toThrow(/moostVite\(\{ headers \}\): invalid header "bad name"/)
  })

  it('warns once that the option is ignored outside middleware mode', () => {
    const [plugin] = moostVite({ entry: './src/main.ts', headers: HEADERS }) as Plugin[]
    const warn = vi.fn()
    ;(plugin.configResolved as Function)({ logger: { warn } })
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0][0]).toContain('middleware mode only')
    expect(warn.mock.calls[0][0]).toContain('defaultHeaders')
  })
})

// ─── CSP nonce: render result → state script + Vite's html.cspNonce placeholder ───

describe('createSSRServer (production) — CSP nonce', () => {
  const NONCE_TEMPLATE =
    '<html><head><meta property="csp-nonce" nonce="NONCE_PH"><!--ssr-head--></head>' +
    '<body><!--ssr-outlet--><!--ssr-state-->' +
    '<script type="module" nonce="NONCE_PH" src="/assets/app-abc123.js"></script></body></html>'
  let dir: string
  beforeAll(async () => {
    dir = await makeStaticDir(NONCE_TEMPLATE)
    writeFileSync(
      join(dir, 'entry-server.mjs'),
      `export function render(url) {
        if (url === '/inject') {
          return { html: 'INJECT', state: '{}', nonce: '"><script>alert(1)</script>' }
        }
        const nonce = 'cmFuZG9tLW5vbmNl'
        return {
          html: 'OK',
          state: '{"a":1}',
          nonce,
          headers: { 'content-security-policy': "script-src 'self' 'nonce-" + nonce + "'" },
        }
      }`,
    )
    g.__MOOST_SSR_ENTRY__ = pathToFileURL(join(dir, 'entry-server.mjs')).href
    g.__MOOST_CSP_NONCE__ = 'NONCE_PH'
  })
  afterAll(() => {
    g.__MOOST_SSR_ENTRY__ = undefined
    g.__MOOST_CSP_NONCE__ = undefined
    rmSync(dir, { recursive: true, force: true })
  })

  it("bakes Vite's html.cspNonce placeholder", () => {
    expect(JSON.parse(serverDefines().__MOOST_CSP_NONCE__)).toBeNull()
    const defines = serverDefines({}, { html: { cspNonce: 'NONCE_PH' } })
    expect(JSON.parse(defines.__MOOST_CSP_NONCE__)).toBe('NONCE_PH')
  })

  it('puts the nonce on the state script and on the tags Vite marked', async () => {
    const server = await start({ port: await freePort(), clientDir: dir })
    const page = await get(server, '/page')
    const html = page.body.toString()
    expect(page.status).toBe(200)
    expect(page.headers['content-security-policy']).toBe(
      "script-src 'self' 'nonce-cmFuZG9tLW5vbmNl'",
    )
    expect(html).toContain('<script nonce="cmFuZG9tLW5vbmNl">window.__SSR_STATE__={"a":1}</script>')
    expect(html).toContain('<meta property="csp-nonce" nonce="cmFuZG9tLW5vbmNl">')
    expect(html).toContain('<script type="module" nonce="cmFuZG9tLW5vbmNl" src="/assets/')
    expect(html).not.toContain('NONCE_PH')
  })

  it('answers 500 for a nonce that is not base64/base64url, without emitting it', async () => {
    const server = await start({ port: await freePort(), clientDir: dir })
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const res = await get(server, '/inject')
      expect(res.status).toBe(500)
      expect(res.body.toString()).not.toContain('<script>alert(1)</script>')
      expect(res.body.toString()).not.toContain('INJECT')
    } finally {
      errors.mockRestore()
    }
  })
})

// ─── use(): a failing middleware fails the request, never the process ───

describe('createSSRServer (production) — failing use() middleware', () => {
  let dir: string
  beforeAll(async () => {
    dir = await makeStaticDir(SPA_TEMPLATE)
  })
  afterAll(() => rmSync(dir, { recursive: true, force: true }))

  it('stops the chain on next(error), a throw or a rejection; answers the status, not the message', async () => {
    const app = await createSSRServer({ clientDir: dir, entry: bootRoutes })
    app.use((req, _res, next) => {
      if (req.url === '/api/plain?deny') {
        next(Object.assign(new Error('secret reason'), { status: 403 }))
        return
      }
      if (req.url === '/api/plain?fail') {
        next(new Error('secret reason'))
        return
      }
      if (req.url === '/api/plain?throw') {
        throw new Error('secret reason')
      }
      next()
    })
    // an async middleware whose promise rejects before it calls next()
    app.use(async (req, _res, next) => {
      if (req.url === '/api/plain?reject') {
        throw Object.assign(new Error('secret reason'), { statusCode: 401 })
      }
      next()
    })
    const server = await app.listen(await freePort(), '127.0.0.1')
    started.push(server)
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      for (const [path, status] of [
        ['/api/plain?deny', 403],
        ['/api/plain?fail', 500],
        ['/api/plain?throw', 500],
        ['/api/plain?reject', 401],
      ] as const) {
        const res = await get(server, path)
        expect(res.status).toBe(status)
        expect(res.body.toString()).toBe('')
      }
      expect(errors).toHaveBeenCalledTimes(4)
      // the process kept serving
      const ok = await get(server, '/api/plain')
      expect(ok).toMatchObject({ status: 200 })
      expect(ok.body.toString()).toBe('plain')
    } finally {
      errors.mockRestore()
    }
  })

  it('rejects an error-handling (err, req, res, next) middleware', async () => {
    const app = await createSSRServer({ clientDir: dir, entry: () => new MoostHttp().listen() })
    const errorHandler = (_err: unknown, _req: unknown, _res: unknown, _next: unknown) => {}
    expect(() => app.use(errorHandler as never)).toThrow(/error-handling/)
  })
})

describe('@moostjs/vite package manifest', () => {
  it('ships sirv as a regular dependency (the SPA/SSR prod server always imports it)', () => {
    const pkg = JSON.parse(
      readFileSync(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf8'),
    ) as Record<string, Record<string, string> | undefined>
    expect(pkg.dependencies?.sirv).toBeDefined()
    expect(pkg.peerDependencies?.sirv).toBeUndefined()
  })
})
