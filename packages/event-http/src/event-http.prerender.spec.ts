import { prerenderJson as wooksPrerenderJson } from '@wooksjs/event-http'
import { Controller, Moost } from 'moost'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { Get } from './decorators'
import { MoostHttp } from './event-http'
import { prerenderJson } from './index'

const envelope = prerenderJson({ fields: ['a', 'b'], version: 1 }, { etag: true })

@Controller()
class MetaController {
  @Get('meta')
  meta() {
    return envelope
  }
}

describe('prerenderJson (re-exported from @wooksjs/event-http)', () => {
  let http: MoostHttp
  let base = ''

  beforeAll(async () => {
    const app = new Moost()
    http = new MoostHttp()
    app.adapter(http)
    app.registerControllers(MetaController)
    await app.init()
    await http.listen(0)
    const { port } = http.getHttpApp().getServer()!.address() as { port: number }
    base = `http://127.0.0.1:${port}`
  })
  afterAll(async () => {
    await http.onDispose()
  })

  it('is the wooks function', () => {
    expect(prerenderJson).toBe(wooksPrerenderJson)
  })

  it('a handler returning a prerendered object sends its JSON with an ETag; a match answers 304', async () => {
    const first = await fetch(`${base}/meta`)
    expect(first.status).toBe(200)
    expect(await first.json()).toEqual({ fields: ['a', 'b'], version: 1 })
    const etag = first.headers.get('etag')
    expect(etag).toMatch(/^W\//)

    const again = await fetch(`${base}/meta`, { headers: { 'if-none-match': etag! } })
    expect(again.status).toBe(304)
  })
})
