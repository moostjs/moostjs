import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import type { AddressInfo, Server } from 'node:net'
import { createServer as createNetServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { MoostHttp } from '@moostjs/event-http'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { createSSRServer } from '../src/prod-server'

/**
 * Drives the PRODUCTION branch of createSSRServer: the build-time defines the
 * plugin bakes into `build:app` are stubbed as globals, and the entry only
 * calls `MoostHttp.listen()` (captured by the server, never binds itself).
 */
const DEFINES = [
  '__MOOST_ENTRY__',
  '__MOOST_SSR_ENTRY__',
  '__MOOST_PREFIX__',
  '__MOOST_SSR_OUTLET__',
  '__MOOST_SSR_STATE__',
  '__MOOST_SSR_HEAD__',
  '__MOOST_SSR_FORWARDING__',
] as const

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
