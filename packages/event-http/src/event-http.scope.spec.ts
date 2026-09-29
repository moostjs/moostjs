import { Controller, getMoostInfact, Injectable, Moost, useControllerContext } from 'moost'
import { afterEach, describe, expect, it } from 'vitest'

import { Body, Post } from './decorators'
import { MoostHttp } from './event-http'

@Injectable('FOR_EVENT')
class RequestPrincipal {
  readonly id = Math.random()
}

@Controller()
class ScopeController {
  @Post('after-body')
  async afterBody(@Body() body: { n: number }) {
    // The body has been consumed by now — the request stream has ended.
    await new Promise((resolve) => setTimeout(resolve, 5))
    const principal = (await useControllerContext().instantiate(
      RequestPrincipal,
    )) as RequestPrincipal
    return { n: body.n, principal: typeof principal.id }
  }
}

describe('MoostHttp event DI scope on a real server', () => {
  let http: MoostHttp | undefined
  afterEach(async () => {
    await http?.onDispose()
    http = undefined
  })

  it('keeps FOR_EVENT dependencies resolvable after the request body was read', async () => {
    const app = new Moost()
    http = new MoostHttp()
    app.adapter(http)
    app.registerControllers(ScopeController)
    await app.init()
    await http.listen(0)
    const address = http.getHttpApp().getServer()!.address() as { port: number }

    const res = await fetch(`http://127.0.0.1:${address.port}/after-body`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ n: 7 }),
    })
    expect(res.status).toBe(201)
    expect(await res.json()).toEqual({ n: 7, principal: 'number' })
  })

  it('releases the event scope once the response is done (real server and in-process request)', async () => {
    const app = new Moost()
    http = new MoostHttp()
    app.adapter(http)
    app.registerControllers(ScopeController)
    await app.init()
    await http.listen(0)
    const address = http.getHttpApp().getServer()!.address() as { port: number }
    const scopes = (getMoostInfact() as unknown as { scopes: Map<string, unknown> }).scopes
    const before = scopes.size

    const res = await fetch(`http://127.0.0.1:${address.port}/after-body`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ n: 1 }),
    })
    expect(res.status).toBe(201)
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(scopes.size).toBe(before)

    const local = await http.request(
      new Request('http://localhost/after-body', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ n: 2 }),
      }),
    )
    expect(local?.status).toBe(201)
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(scopes.size).toBe(before)
  })
})
