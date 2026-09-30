import { Readable } from 'node:stream'

import { useResponse } from '@wooksjs/event-http'
import {
  Controller,
  getMoostInfact,
  Injectable,
  Moost,
  useControllerContext,
  useScopeId,
} from 'moost'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { Body, Get, Post } from './decorators'
import { MoostHttp } from './event-http'

@Injectable('FOR_EVENT')
class RequestPrincipal {
  readonly id = Math.random()
}

function resolvePrincipal() {
  return useControllerContext().instantiate(RequestPrincipal) as Promise<RequestPrincipal>
}

function makeProbe() {
  return {
    started: Promise.withResolvers<undefined>(),
    handlerDone: Promise.withResolvers<string>(),
    streamClosed: Promise.withResolvers<boolean>(),
    scopeAliveWhileStreaming: [] as boolean[],
  }
}
let probe = makeProbe()

function scopes() {
  return (getMoostInfact() as unknown as { scopes: Map<string, unknown> }).scopes
}

@Controller()
class ScopeController {
  @Post('after-body')
  async afterBody(@Body() body: { n: number }) {
    // The body has been consumed by now — the request stream has ended.
    await new Promise((resolve) => setTimeout(resolve, 5))
    const principal = await resolvePrincipal()
    return { n: body.n, principal: typeof principal.id }
  }

  @Post('slow')
  async slow(@Body() body: { n: number }) {
    const closed = Promise.withResolvers<undefined>()
    useResponse()
      .getRawRes(true)
      .once('close', () => closed.resolve(undefined))
    probe.started.resolve(undefined)
    await closed.promise // the client is gone before the handler finishes
    try {
      const principal = await resolvePrincipal()
      probe.handlerDone.resolve(typeof principal.id)
    } catch (error) {
      probe.handlerDone.resolve((error as Error).message)
    }
    return body
  }

  @Get('stream')
  stream() {
    return makeStream(5)
  }

  @Post('stream')
  streamAfterBody(@Body() body: { chunks: number }) {
    return makeStream(body.chunks)
  }
}

function makeStream(chunks: number) {
  const scopeId = useScopeId()
  let i = 0
  const stream = new Readable({
    read() {
      setTimeout(() => {
        probe.scopeAliveWhileStreaming.push(scopes().has(scopeId))
        if (i === 1) {
          probe.started.resolve(undefined)
        }
        this.push(i++ < chunks ? `chunk-${i};` : null)
      }, 5)
    },
  })
  stream.once('close', () => probe.streamClosed.resolve(stream.destroyed))
  return stream
}

describe('MoostHttp event DI scope on a real server', () => {
  let http: MoostHttp | undefined
  let base = ''
  let before = 0

  beforeEach(async () => {
    probe = makeProbe()
    const app = new Moost()
    http = new MoostHttp()
    app.adapter(http)
    app.registerControllers(ScopeController)
    await app.init()
    await http.listen(0)
    const { port } = http.getHttpApp().getServer()!.address() as { port: number }
    base = `http://127.0.0.1:${port}`
    before = scopes().size
  })
  afterEach(async () => {
    await http?.onDispose()
    http = undefined
  })

  const released = () => vi.waitFor(() => expect(scopes().size).toBe(before))

  function post(path: string, body: unknown, signal?: AbortSignal) {
    return fetch(`${base}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    })
  }

  it('keeps FOR_EVENT dependencies resolvable after the request body was read', async () => {
    const res = await post('/after-body', { n: 7 })
    expect(res.status).toBe(201)
    expect(await res.json()).toEqual({ n: 7, principal: 'number' })
    await released()
  })

  it('releases the event scope of an in-process request', async () => {
    const res = await http!.request(
      new Request('http://localhost/after-body', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ n: 2 }),
      }),
    )
    expect(res?.status).toBe(201)
    await released()
  })

  it('keeps the scope for a handler still running after the client aborted', async () => {
    const ac = new AbortController()
    const req = post('/slow', { n: 1 }, ac.signal).catch((error: Error) => error.name)
    await probe.started.promise
    ac.abort()
    expect(await req).toBe('AbortError')
    expect(await probe.handlerDone.promise).toBe('number')
    await released()
  })

  it.each([
    ['GET', () => fetch(`${base}/stream`)],
    ['POST', () => post('/stream', { chunks: 5 })],
  ])('keeps the scope alive until a streamed %s response is fully sent', async (_, send) => {
    const res = await send()
    expect(res.ok).toBe(true)
    expect(await res.text()).toBe('chunk-1;chunk-2;chunk-3;chunk-4;chunk-5;')
    expect(probe.scopeAliveWhileStreaming).not.toContain(false)
    await released()
  })

  it.each([
    ['GET', (signal: AbortSignal) => fetch(`${base}/stream`, { signal })],
    ['POST', (signal: AbortSignal) => post('/stream', { chunks: 1000 }, signal)],
  ])(
    'destroys the stream and releases the scope when the client aborts a streamed %s',
    async (_, send) => {
      const ac = new AbortController()
      const res = await send(ac.signal)
      expect(res.ok).toBe(true)
      await probe.started.promise
      ac.abort()
      expect(await probe.streamClosed.promise).toBe(true)
      await released()
    },
  )
})
