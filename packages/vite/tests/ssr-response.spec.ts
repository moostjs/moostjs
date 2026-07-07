import type { ServerResponse } from 'node:http'
import { describe, expect, it } from 'vitest'

import type { TSSRMarkers, TSSRRenderResult } from '../src/utils'
import { DEFAULT_SSR_HEAD, DEFAULT_SSR_OUTLET, DEFAULT_SSR_STATE, sendSSRResponse } from '../src/utils'

const MARKERS: TSSRMarkers = {
  ssrOutlet: DEFAULT_SSR_OUTLET,
  ssrState: DEFAULT_SSR_STATE,
  ssrHead: DEFAULT_SSR_HEAD,
}

const TEMPLATE = `<html><head><!--ssr-head--><!--ssr-state--></head><body><!--ssr-outlet--></body></html>`

interface TFakeRes {
  statusCode: number
  headers: Record<string, string>
  body: string
  res: ServerResponse
}

function fakeRes(): TFakeRes {
  const state: TFakeRes = {
    statusCode: 0,
    headers: {},
    body: '',
    res: null as unknown as ServerResponse,
  }
  state.res = {
    get statusCode() {
      return state.statusCode
    },
    set statusCode(v: number) {
      state.statusCode = v
    },
    setHeader(name: string, value: string) {
      // Node stores header names case-insensitively.
      state.headers[name.toLowerCase()] = value
    },
    end(body: string) {
      state.body = body
    },
  } as unknown as ServerResponse

  return state
}

function render(fake: TFakeRes, result: TSSRRenderResult, template = TEMPLATE) {
  sendSSRResponse(fake.res, template, MARKERS, result)
}

describe('sendSSRResponse', () => {
  it('substitutes outlet, state and head markers', () => {
    const fake = fakeRes()
    render(fake, { html: '<div>app</div>', state: '{"a":1}', head: '<title>Hi</title>' })
    expect(fake.body).toBe(
      `<html><head><title>Hi</title><script>window.__SSR_STATE__={"a":1}</script></head><body><div>app</div></body></html>`,
    )
  })

  it('defaults status to 200 and Content-Type to text/html', () => {
    const fake = fakeRes()
    render(fake, { html: 'x' })
    expect(fake.statusCode).toBe(200)
    expect(fake.headers['content-type']).toBe('text/html')
  })

  it('emits no state script and no head when those fields are absent', () => {
    const fake = fakeRes()
    render(fake, { html: 'x' })
    expect(fake.body).toBe(`<html><head></head><body>x</body></html>`)
  })

  it('applies a custom status code', () => {
    const fake = fakeRes()
    render(fake, { html: 'not found', status: 404 })
    expect(fake.statusCode).toBe(404)
  })

  it('applies extra headers, letting the render override Content-Type', () => {
    const fake = fakeRes()
    render(fake, {
      html: '',
      status: 301,
      headers: { location: '/new', 'cache-control': 'no-store', 'Content-Type': 'text/plain' },
    })
    expect(fake.statusCode).toBe(301)
    expect(fake.headers.location).toBe('/new')
    expect(fake.headers['cache-control']).toBe('no-store')
    expect(fake.headers['content-type']).toBe('text/plain')
  })

  it('is a no-op for markers missing from the template (backwards compatible)', () => {
    const fake = fakeRes()
    const plain = `<html><body>static</body></html>`
    render(fake, { html: 'x', state: '{}', head: '<title/>' }, plain)
    expect(fake.body).toBe(plain)
  })

  it('inserts $-sequences in payloads literally (no String.replace pattern interpretation)', () => {
    const fake = fakeRes()
    render(fake, {
      html: 'price $5 & $$ and $& and $1',
      state: '{"re":"$&$1$`"}',
      head: '<meta content="$$$&">',
    })
    expect(fake.body).toContain('price $5 & $$ and $& and $1')
    expect(fake.body).toContain('<script>window.__SSR_STATE__={"re":"$&$1$`"}</script>')
    expect(fake.body).toContain('<meta content="$$$&">')
  })
})
