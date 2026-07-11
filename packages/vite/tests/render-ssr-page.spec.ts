import { IncomingMessage, ServerResponse } from 'node:http'
import { Socket } from 'node:net'

import { httpKind, MoostHttp, useHttpContext } from '@moostjs/event-http'
import { describe, expect, it } from 'vitest'

import type { TSSRHttpContextRunner, TSSRRenderContext, TSSRRenderResult } from '../src/utils'
import { renderSSRPage } from '../src/utils'

function fakePageRequest(headers: Record<string, string> = {}) {
  const req = new IncomingMessage(new Socket())
  req.method = 'GET'
  req.url = '/page'
  req.headers = headers
  const res = new ServerResponse(req)
  return { req, res }
}

function setCookies(res: ServerResponse): string[] {
  const value = res.getHeader('set-cookie')
  if (value === undefined) {
    return []
  }
  return Array.isArray(value) ? value.map(String) : [String(value)]
}

describe('renderSSRPage', () => {
  it('passes the page request context as the second render argument (no http runner)', async () => {
    const { req, res } = fakePageRequest({ 'accept-language': 'nl' })
    let seenUrl = ''
    let seenCtx: TSSRRenderContext | undefined
    const result = await renderSSRPage({
      render: (url, ctx) => {
        seenUrl = url
        seenCtx = ctx
        return { html: 'ok' }
      },
      url: '/page?q=1',
      req,
      res,
      http: null,
    })
    expect(result).toEqual({ html: 'ok' })
    expect(seenUrl).toBe('/page?q=1')
    expect(seenCtx!.headers).toBe(req.headers)
    expect(seenCtx!.method).toBe('GET')
    expect(seenCtx!.req).toBe(req)
  })

  it('keeps old-style render(url) entries working untouched', async () => {
    const { req, res } = fakePageRequest()
    const render = (url: string) => Promise.resolve({ html: `page:${url}` })
    const result = await renderSSRPage({ render, url: '/x', req, res, http: null })
    expect(result).toEqual({ html: 'page:/x' })
  })

  it('degrades to a plain render when the adapter predates withHttpContext', async () => {
    const { req, res } = fakePageRequest()
    const legacyAdapter = {} as TSSRHttpContextRunner
    const result = await renderSSRPage({
      render: () => ({ html: 'legacy' }),
      url: '/x',
      req,
      res,
      http: legacyAdapter,
    })
    expect(result).toEqual({ html: 'legacy' })
  })

  it('runs the render through the http runner and drains Set-Cookie onto the page response', async () => {
    const { req, res } = fakePageRequest()
    let ranInsideRunner = false
    const runner: TSSRHttpContextRunner = {
      async withHttpContext(reqArg, resArg, fn) {
        expect(reqArg).toBe(req)
        expect(resArg).toBe(res)
        ranInsideRunner = true
        return {
          result: (await fn()) as Awaited<ReturnType<typeof fn>>,
          response: { getSetCookieStrings: () => ['sid=1; Path=/', 'ab=x'] },
        }
      },
    }
    const result = await renderSSRPage({
      render: () => ({ html: 'wrapped' }),
      url: '/x',
      req,
      res,
      http: runner,
    })
    expect(ranInsideRunner).toBe(true)
    expect(result).toEqual({ html: 'wrapped' })
    expect(setCookies(res)).toEqual(['sid=1; Path=/', 'ab=x'])
  })

  describe('with a real MoostHttp adapter', () => {
    // An API route that echoes the identity headers it received and touches a
    // cookie — the SSR self-call shape from the proposal.
    function createApp() {
      const http = new MoostHttp()
      http.getHttpApp().get('/whoami', () => {
        const ctx = useHttpContext()
        const apiReq = ctx.get(httpKind.keys.req)
        ctx.get(httpKind.keys.response)?.setCookie('session', 'refreshed', { path: '/' })
        return {
          authorization: apiReq?.headers.authorization ?? null,
          cookie: apiReq?.headers.cookie ?? null,
          requestId: apiReq?.headers['x-request-id'] ?? null,
        }
      })
      return http
    }

    const render = (http: MoostHttp) => async (): Promise<TSSRRenderResult> => {
      const response = await http.request('/whoami')
      return { html: JSON.stringify(await response!.json()) }
    }

    // Shared: the default wooks router is a singleton, so a second createApp()
    // would register a duplicate GET:/whoami.
    const http = createApp()

    it('SSR self-calls inherit the page viewer identity and Set-Cookie flows back', async () => {
      const { req, res } = fakePageRequest({
        authorization: 'Bearer viewer-token',
        cookie: 'sid=abc',
        'x-request-id': 'trace-1',
      })
      const result = await renderSSRPage({ render: render(http), url: '/page', req, res, http })
      expect(JSON.parse(result.html)).toEqual({
        authorization: 'Bearer viewer-token',
        cookie: 'sid=abc',
        requestId: 'trace-1',
      })
      expect(setCookies(res).some((c) => c.startsWith('session=refreshed'))).toBe(true)
    })

    it('SSR self-calls stay anonymous when no http runner is passed (forwarding off)', async () => {
      const { req, res } = fakePageRequest({ authorization: 'Bearer viewer-token' })
      const result = await renderSSRPage({
        render: render(http),
        url: '/page',
        req,
        res,
        http: null,
      })
      expect(JSON.parse(result.html)).toEqual({
        authorization: null,
        cookie: null,
        requestId: null,
      })
      expect(setCookies(res)).toEqual([])
    })
  })
})
