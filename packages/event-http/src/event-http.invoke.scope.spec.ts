import { useBody } from '@wooksjs/http-body'
import { HttpError, useRequest, useResponse } from '@wooksjs/event-http'
import type { EventContext } from 'moost'
import {
  Controller,
  defineBeforeInterceptor,
  getMoostInfact,
  Injectable,
  Intercept,
  Moost,
  Param,
  TInterceptorPriority,
  useControllerContext,
  useScopeId,
  withControllerContext,
} from 'moost'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { Body, Post, RawBody } from './decorators'
import { MoostHttp } from './event-http'

@Injectable('FOR_EVENT')
class RequestPrincipal {
  readonly id = Math.random()
}

function resolvePrincipal() {
  return useControllerContext().instantiate(RequestPrincipal) as Promise<RequestPrincipal>
}

function scopes() {
  return (getMoostInfact() as unknown as { scopes: Map<string, unknown> }).scopes
}

const guardSeen: unknown[] = []

/** A guard authorizing on the raw body — must see the INVOKED body, never the caller's. */
const idsGuard = defineBeforeInterceptor(async (reply) => {
  const body = await useBody().parseBody<{ ids?: number[] }>()
  guardSeen.push(body.ids)
  for (const id of body.ids ?? []) {
    if (id === 13) {
      reply(new HttpError(403, `not owner of ${id}`))
      return
    }
  }
}, TInterceptorPriority.GUARD)

@Controller('source')
class SourceController {
  @Post('close')
  @Intercept(idsGuard)
  async close(@Body() body: { ids: number[] }, @RawBody() raw: Buffer) {
    const principal = await resolvePrincipal()
    const fromRequest = await useRequest().rawBody()
    useResponse().setStatus(299).setHeader('x-source', 'leak')
    return {
      ids: body.ids,
      raw: raw.toString(),
      fromRequest: fromRequest.toString(),
      principal: principal.id,
      scope: useScopeId(),
      route: useControllerContext().getRoute(),
    }
  }

  @Post(':tenant/fail')
  fail(@Param('tenant') tenant: string) {
    throw new HttpError(409, `refused for ${tenant}`)
  }

  // two handlers on one path: a RETURNED Error is the answer — the next handler never runs
  @Post('dual')
  dualFirst() {
    return new HttpError(418, 'first answers')
  }

  @Post('dual')
  dualSecond() {
    return { second: true }
  }
}

@Controller('view')
class ViewController {
  @Post('run')
  async run(@Body() body: { query: string; n: number }) {
    const http = (await useControllerContext().instantiate(MoostHttp)) as MoostHttp
    const principal = await resolvePrincipal()
    const before = scopes().size
    const closeListeners = useResponse().getRawRes(true).listenerCount('close')
    const results: Record<string, unknown>[] = []
    const children: EventContext[] = []
    const keepChild = (ctx: EventContext) => {
      children.push(ctx)
    }
    for (let i = 0; i < body.n; i++) {
      results.push(
        await http.invoke('POST', '/source/close', {
          body: { ids: [i, i + 1] },
          prepare: keepChild,
        }),
      )
    }
    // `prepare` hands out the route's child context — readable after the route settled
    const childRoute = useControllerContext(children[0]).getRoute()
    const failure = await http
      .invoke('POST', '/source/acme/fail', { body: {} })
      .catch((error: unknown) => error)
    const missing = await http
      .invoke('POST', '/source/nope', { body: {} })
      .catch((error: unknown) => error)
    const refused = await http
      .invoke('POST', '/source/close', { body: { ids: [13] } })
      .catch((error: unknown) => error)
    const returned = await http
      .invoke('POST', '/source/dual', { body: {} })
      .catch((error: unknown) => error)
    const response = useResponse()
    const viewBody = await useBody().parseBody<{ query: string }>()
    return {
      results,
      viewBody: viewBody.query,
      viewRoute: useControllerContext().getRoute(),
      childRoute,
      viewPrincipal: principal.id,
      viewScope: useScopeId(),
      // every invoked scope was released when its handler settled
      scopesGrew: scopes().size - before,
      closeListenersGrew: response.getRawRes(true).listenerCount('close') - closeListeners,
      status: response.status,
      header: response.getHeader('x-source') ?? null,
      failure: (failure as HttpError).body,
      missing: (missing as HttpError).body.statusCode,
      refused: refused instanceof HttpError ? refused.body : refused,
      returned: returned instanceof HttpError ? returned.body : returned,
    }
  }

  @Post('as-source')
  async asSource() {
    const principal = await resolvePrincipal()
    const source = (await useControllerContext().instantiate(SourceController)) as SourceController
    const shared = await withControllerContext(source, 'close', async () => {
      const p = await resolvePrincipal()
      return { principal: p.id, controller: useControllerContext().getController() === source }
    })
    const own = await withControllerContext(
      source,
      'close',
      async () => {
        const p = await resolvePrincipal()
        return p.id
      },
      {
        shareScope: false,
      },
    )
    return {
      sharedIsView: shared.principal === principal.id,
      controller: shared.controller,
      ownIsView: own === principal.id,
      viewController: useControllerContext().getController() instanceof ViewController,
    }
  }
}

describe('MoostHttp.invoke / withControllerContext on a real server', () => {
  let http: MoostHttp | undefined
  let base = ''
  let before = 0

  beforeEach(async () => {
    guardSeen.length = 0
    const app = new Moost()
    http = new MoostHttp()
    app.adapter(http)
    app.registerControllers(SourceController, ViewController)
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

  function post(path: string, body: unknown) {
    return fetch(`${base}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
  }

  it('runs the routed pipeline with the invoked body, its own scope and route — the caller is untouched', async () => {
    const res = await post('/view/run', { query: 'status=open', n: 3 })
    expect(res.status).toBe(201)
    expect(res.headers.get('x-source')).toBeNull()
    const out = await res.json()

    // body readers (guard via useBody, @Body, @RawBody, useRequest().rawBody) see the invoked body
    expect(guardSeen).toEqual([[0, 1], [1, 2], [2, 3], [13]])
    expect(out.results.map((r: { ids: number[] }) => r.ids)).toEqual([
      [0, 1],
      [1, 2],
      [2, 3],
    ])
    for (const r of out.results) {
      expect(r.raw).toBe(JSON.stringify({ ids: r.ids }))
      expect(r.fromRequest).toBe(r.raw)
      expect(r.route).toBe('/source/close')
      // its own FOR_EVENT scope and instances
      expect(r.scope).not.toBe(out.viewScope)
      expect(r.principal).not.toBe(out.viewPrincipal)
    }
    expect(new Set(out.results.map((r: { scope: string }) => r.scope)).size).toBe(3)

    // the caller's body, controller context and response stay its own
    expect(out.viewBody).toBe('status=open')
    expect(out.viewRoute).toBe('/view/run')
    expect(out.childRoute).toBe('/source/close')
    expect(out.status).toBe(0)
    expect(out.header).toBeNull()

    // scopes are released per invocation; no response listener piles up
    expect(out.scopesGrew).toBe(0)
    expect(out.closeListenersGrew).toBe(0)

    // errors: thrown, replied by a guard, unknown route
    expect(out.failure).toMatchObject({ statusCode: 409, message: 'refused for acme' })
    expect(out.refused).toMatchObject({ statusCode: 403, message: 'not owner of 13' })
    expect(out.missing).toBe(404)
    // a returned Error answers like a routed request does — no fall-through to the next handler
    expect(out.returned).toMatchObject({ statusCode: 418, message: 'first answers' })
    const routed = await post('/source/dual', {})
    expect(routed.status).toBe(418)
    await released()
  })

  it('withControllerContext shares the event DI scope (FOR_EVENT resolves) or owns one', async () => {
    const res = await post('/view/as-source', {})
    expect(res.status).toBe(201)
    expect(await res.json()).toEqual({
      sharedIsView: true,
      controller: true,
      ownIsView: false,
      viewController: true,
    })
    await released()
  })
})
