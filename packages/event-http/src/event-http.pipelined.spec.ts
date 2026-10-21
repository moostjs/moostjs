// oxlint-disable max-classes-per-file
import { connect } from 'node:net'
import { Readable } from 'node:stream'
import {
  Controller,
  current,
  getMoostInfact,
  Injectable,
  Moost,
  run,
  useControllerContext,
  useScopeId,
} from 'moost'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { Get } from './decorators'
import { MoostHttp } from './event-http'

@Injectable('FOR_EVENT')
class Principal {
  readonly id = Math.random()
}

function scopes() {
  return (getMoostInfact() as unknown as { scopes: Map<string, unknown> }).scopes
}

/** Per request: whether its event scope was alive at each streamed chunk. */
let alive: boolean[][] = []

@Controller()
class PipelinedController {
  @Get('stream/:tag')
  stream() {
    const ctx = current()
    const scopeId = useScopeId()
    const seen: boolean[] = []
    alive.push(seen)
    let i = 0
    return new Readable({
      read() {
        setTimeout(async () => {
          const isAlive = await run(ctx, () => useControllerContext().instantiate(Principal)).then(
            () => scopes().has(scopeId),
            () => false,
          )
          seen.push(isAlive)
          this.push(i++ < 4 ? `c${i};` : null)
        }, 10)
      },
    })
  }

  @Get('slow')
  async slow() {
    await useControllerContext().instantiate(Principal)
    await new Promise((resolve) => setTimeout(resolve, 100))
    return 'slow'
  }

  @Get('queued')
  async queued() {
    await useControllerContext().instantiate(Principal)
    return 'queued'
  }
}

describe('MoostHttp event DI scope of pipelined HTTP/1.1 requests', () => {
  let http: MoostHttp
  let port = 0
  let before = 0

  beforeEach(async () => {
    alive = []
    const app = new Moost()
    http = new MoostHttp()
    app.adapter(http)
    app.registerControllers(PipelinedController)
    await app.init()
    await http.listen(0)
    const address = http.getHttpApp().getServer()?.address()
    port = typeof address === 'object' && address ? address.port : 0
    before = scopes().size
  })
  afterEach(async () => {
    await http.onDispose()
  })

  it('keeps the scope of a queued request alive while its streamed body is sent', async () => {
    const socket = connect(port, '127.0.0.1')
    socket.write(
      'GET /stream/a HTTP/1.1\r\nHost: x\r\n\r\n' +
        'GET /stream/b HTTP/1.1\r\nHost: x\r\nConnection: close\r\n\r\n',
    )
    socket.on('data', () => {})
    await new Promise((resolve) => socket.on('close', resolve))

    expect(alive).toHaveLength(2)
    for (const perRequest of alive) {
      expect(perRequest.length).toBeGreaterThan(0)
      expect(perRequest.every(Boolean)).toBe(true)
    }
    await vi.waitFor(() => expect(scopes().size).toBe(before))
  })

  it('takes one connection listener for many queued requests, and releases every scope', async () => {
    const warnings: string[] = []
    const onWarning = (warning: Error) => void warnings.push(warning.name)
    process.on('warning', onWarning)
    try {
      const socket = connect(port, '127.0.0.1')
      const queued = Array.from({ length: 15 }, () => 'GET /queued HTTP/1.1\r\nHost: x\r\n\r\n')
      socket.write(`GET /slow HTTP/1.1\r\nHost: x\r\n\r\n${queued.join('')}`)
      let answered = 0
      socket.on('data', (chunk: Buffer) => {
        answered += chunk.toString().match(/HTTP\/1\.1 200/g)?.length ?? 0
      })
      await vi.waitFor(() => expect(answered).toBe(16), { timeout: 2000 })
      socket.destroy()
      await vi.waitFor(() => expect(scopes().size).toBe(before), { timeout: 2000 })
      await new Promise((resolve) => setTimeout(resolve, 20)) // warnings are emitted on a later tick
      expect(warnings).not.toContain('MaxListenersExceededWarning')
    } finally {
      process.off('warning', onWarning)
    }
  })

  it('releases the scope of a queued request when the client disconnects before its turn', async () => {
    const socket = connect(port, '127.0.0.1')
    socket.write('GET /slow HTTP/1.1\r\nHost: x\r\n\r\nGET /queued HTTP/1.1\r\nHost: x\r\n\r\n')
    socket.on('data', () => {})
    await new Promise((resolve) => setTimeout(resolve, 30))
    socket.destroy()
    await vi.waitFor(() => expect(scopes().size).toBe(before), { timeout: 2000 })
  })
})
