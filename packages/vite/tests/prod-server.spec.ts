import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import type { AddressInfo, Server } from 'node:net'
import { createServer as createNetServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { MoostHttp } from '@moostjs/event-http'
import type { Plugin } from 'vite'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { moostVite } from '../src/moost-vite'
import type { TMoostViteDevOptions } from '../src/moost-vite'
import { createSSRServer } from '../src/prod-server'

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
function serverDefines(options: Partial<TMoostViteDevOptions> = {}): Record<string, string> {
  const [plugin] = moostVite({ entry: './src/main.ts', middleware: true, ...options }) as Plugin[]
  const config = (plugin.config as Function)(
    { root: clientDir },
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
