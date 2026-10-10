import { createServer } from 'node:http'
import type { IncomingMessage, Server, ServerResponse } from 'node:http'

import { tryGetCurrent } from '@wooksjs/event-core'
import {
  Controller,
  ContextInjector,
  Moost,
  replaceContextInjector,
  resetContextInjector,
} from 'moost'
import type { TContextInjectorHook } from 'moost'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { Get } from './decorators'
import { MoostHttp } from './event-http'
import { enableLocalFetch } from './local-fetch'

@Controller('users')
class UsersController {
  @Get(':id')
  getUser() {
    return { ok: true }
  }
}

/** Records the events started and the routing hooks — what a tracing context injector sees. */
class EventRecorder extends ContextInjector<TContextInjectorHook> {
  events: string[] = []
  routed: string[] = []
  with<T>(name: TContextInjectorHook, attributes: unknown, cb?: () => T): T {
    const fn = (typeof attributes === 'function' ? attributes : cb) as () => T
    if (name === 'Event:start') {
      this.events.push((attributes as { eventType: string }).eventType)
    }
    return fn()
  }
  hook(method: string, name: string, route?: string): void {
    if (name.startsWith('Handler:')) {
      this.routed.push(`${name} ${method} ${route ?? ''}`.trim())
    }
  }
}

describe('MoostHttp.getServerCb(onNoMatch) — middleware mode', () => {
  const recorder = new EventRecorder()
  let http: MoostHttp
  let server: Server
  let base: string
  let noMatchInEvent: boolean[] = []

  beforeAll(async () => {
    replaceContextInjector(recorder)
    const app = new Moost()
    http = new MoostHttp()
    app.adapter(http)
    app.registerControllers(UsersController)
    await app.init()
    const cb = http.getServerCb((_req: IncomingMessage, res: ServerResponse) => {
      noMatchInEvent.push(!!tryGetCurrent())
      res.end('host')
    })
    server = createServer(cb)
    await new Promise<void>((resolve) => server.listen(0, resolve))
    base = `http://127.0.0.1:${(server.address() as { port: number }).port}`
  })

  beforeEach(() => {
    recorder.events = []
    recorder.routed = []
    noMatchInEvent = []
  })

  afterAll(async () => {
    resetContextInjector()
    await new Promise((resolve) => server.close(resolve))
  })

  it('serves a matched route as a Moost event', async () => {
    const res = await fetch(`${base}/users/1?full=1`)
    expect(await res.json()).toEqual({ ok: true })
    expect(recorder.events).toEqual(['http'])
    expect(recorder.routed).toEqual(['Handler:routed GET /users/:id'])
    expect(noMatchInEvent).toEqual([])
  })

  it('hands an unmatched request to onNoMatch before any Moost event starts', async () => {
    const res = await fetch(`${base}/assets/app.js`)
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('host')
    expect(noMatchInEvent).toEqual([false])
    expect(recorder.events).toEqual([])
    expect(recorder.routed).toEqual([])
  })

  it('local fetch falls back to the original fetch for an unmatched Request, body unread', async () => {
    const original = globalThis.fetch
    const fallback = vi.fn((_input: RequestInfo | URL) => Promise.resolve(new Response('network')))
    globalThis.fetch = fallback as typeof fetch
    const teardown = enableLocalFetch(http)
    try {
      const request = new Request('http://localhost/missing', { method: 'POST', body: 'payload' })
      const res = await fetch(request)
      expect(await res.text()).toBe('network')
      expect(fallback).toHaveBeenCalledOnce()
      expect(await (fallback.mock.calls[0][0] as Request).text()).toBe('payload')
      expect(recorder.events).toEqual([])
    } finally {
      teardown()
      globalThis.fetch = original
    }
  })
})
