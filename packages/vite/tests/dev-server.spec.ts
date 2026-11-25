import { fileURLToPath } from 'node:url'
import { beforeAll, describe, expect, it } from 'vitest'

import { assertFreshBuilds, runDriver } from './driver-harness'

/**
 * The dev server, as an app runs it: `vite` with `moostVite({ headers })`, and
 * `createSSRServer()` with `headers` and `use()`. Runs in a child Node process
 * (see dev-server.driver.mjs) against the BUILT plugin — requires `pnpm build vite`.
 */

interface TProbe {
  status: number
  headers: Record<string, string>
  text: string
}

interface TReport {
  route: TProbe
  routeOwn: TProbe
  page: TProbe
  pageOwn: TProbe
  publicFile: TProbe
  module: TProbe
  mwOnly?: TProbe
  mwError?: TProbe
  mwThrow?: TProbe
  mwReject?: TProbe
  afterFailures?: TProbe
}

const DRIVER = fileURLToPath(new URL('dev-server.driver.mjs', import.meta.url))
const HEADERS = { 'x-frame-options': 'DENY', 'x-shared': 'base' }
const NONCE = 'ZGV2LW5vbmNl'

let plugin: TReport
let server: TReport

beforeAll(async () => {
  assertFreshBuilds(['vite'])
  plugin = await runDriver<TReport>(DRIVER, ['plugin'], 120_000)
  server = await runDriver<TReport>(DRIVER, ['server'], 120_000)
}, 300_000)

describe.each([
  ['vite + moostVite({ headers })', () => plugin],
  ['createSSRServer({ headers })', () => server],
])('dev server: %s', (_name, report) => {
  it('sets the headers on Moost routes, SSR pages, public files and Vite modules', () => {
    const { route, page, publicFile, module } = report()
    expect(route).toMatchObject({ status: 200, text: 'plain', headers: HEADERS })
    expect(page.status).toBe(200)
    expect(page.text).toContain('PAGE /page')
    expect(page.headers).toMatchObject(HEADERS)
    expect(publicFile.status).toBe(200)
    expect(publicFile.headers['x-frame-options']).toBe('DENY')
    expect(module.text).toContain('client_v1')
    expect(module.headers).toMatchObject(HEADERS)
  })

  it('lets a route and the render result replace them', () => {
    expect(report().routeOwn.headers['x-shared']).toBe('route')
    expect(report().pageOwn.headers['x-shared']).toBe('render')
  })

  it("puts the render's nonce on the state script and on Vite's html.cspNonce tags", () => {
    const { text } = report().page
    expect(text).toContain(`<script nonce="${NONCE}">window.__SSR_STATE__={"a":1}</script>`)
    expect(text).toContain(`<script type="module" src="/src/ui/client.ts" nonce="${NONCE}">`)
    expect(text).toContain(`<meta property="csp-nonce" nonce="${NONCE}">`)
    expect(text).not.toContain('NONCE_PH')
  })
})

describe('dev server: createSSRServer().use()', () => {
  it("runs before Moost routes, Vite's middlewares and the SSR page", () => {
    for (const probe of [server.route, server.page, server.publicFile, server.module]) {
      expect(probe.headers['x-mw']).toBe('1')
    }
    // a middleware that answers is not overtaken by the SSR page
    expect(server.mwOnly).toMatchObject({ status: 200, text: 'MW' })
  })

  it("fails the request on next(error), a throw or a rejection — Vite's error page, never the SSR page", () => {
    for (const probe of [server.mwError, server.mwThrow, server.mwReject]) {
      expect(probe?.status).toBe(500)
      expect(probe?.text).not.toContain('PAGE /')
    }
    // the process kept serving
    expect(server.afterFailures).toMatchObject({ status: 200, text: 'plain' })
  })

  it('runs after the headers option, so it can replace them', () => {
    expect(server.publicFile.headers['x-shared']).toBe('middleware')
  })

  it("createSSRServer({ headers }) replaces the plugin's headers", () => {
    expect(server.route.headers['x-plugin-only']).toBeUndefined()
    expect(server.route.headers['x-frame-options']).toBe('DENY')
  })
})
