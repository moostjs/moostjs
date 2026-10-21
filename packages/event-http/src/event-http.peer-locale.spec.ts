import { useAcceptLanguage } from '@wooksjs/event-http'
import { clearGlobalWooks, Controller, Locale, Moost, setTranslator, useTranslate } from 'moost'
import { afterEach, describe, expect, it } from 'vitest'

import { Get, Ip } from './decorators'
import { MoostHttp } from './event-http'
import type { TFetchPeer, TTrustProxy } from './index'

@Controller()
class PeerController {
  @Get('ip')
  ip(@Ip() ip: string) {
    return { ip }
  }

  @Get('locale')
  locale(@Locale() locale: string | undefined) {
    return { locale: locale ?? null }
  }

  @Get('greet')
  greet() {
    const t = useTranslate()
    return { text: t('Hello, {name}', { name: 'Ann' }), untouched: t('No translation') }
  }
}

async function boot(http: MoostHttp) {
  clearGlobalWooks()
  const app = new Moost()
  app.adapter(http)
  app.registerControllers(PeerController)
  await app.init()
  return http
}

function json(res: Response | null) {
  if (!res) {
    throw new Error('no route')
  }
  return res.json() as Promise<Record<string, unknown>>
}

afterEach(() => {
  setTranslator(undefined)
})

describe('MoostHttp.fetch(request, peer) — fetch runtimes', () => {
  it('passes the connection peer to the app (@Ip() is the peer, no proxy trusted)', async () => {
    const http = await boot(new MoostHttp())
    const peer: TFetchPeer = { remoteAddress: '203.0.113.7' }
    const res = await http.fetch(
      new Request('http://localhost/ip', { headers: { 'x-forwarded-for': '198.51.100.1' } }),
      peer,
    )
    expect(await json(res)).toEqual({ ip: '203.0.113.7' })
  })

  it('@Ip() follows the app-level trustProxy (right-most untrusted hop)', async () => {
    const trustProxy: TTrustProxy = ['loopback']
    const http = await boot(new MoostHttp({ trustProxy }))
    const res = await http.fetch(
      new Request('http://localhost/ip', {
        headers: { 'x-forwarded-for': '198.51.100.9, 192.0.2.4' },
      }),
      { remoteAddress: '127.0.0.1' },
    )
    expect(await json(res)).toEqual({ ip: '192.0.2.4' })
  })
})

describe('@Locale()', () => {
  it('resolves the locale of the event (MoostHttp passes resolveLocale through)', async () => {
    const http = await boot(
      new MoostHttp({
        resolveLocale: () => useAcceptLanguage().negotiate(['en', 'de'], 'en'),
      }),
    )
    const res = await http.request('/locale', { headers: { 'accept-language': 'de-CH, en;q=0.5' } })
    expect(res?.headers.get('vary')).toMatch(/accept-language/i)
    expect(await json(res)).toEqual({ locale: 'de' })
  })

  it('resolves undefined when the app has no locale policy', async () => {
    const http = await boot(new MoostHttp())
    expect(await json(await http.request('/locale'))).toEqual({ locale: null })
  })
})

describe('setTranslator() / useTranslate()', () => {
  it('translates with the registered translator in the event locale; undefined keeps the text', async () => {
    const http = await boot(new MoostHttp({ resolveLocale: () => 'de' }))
    const calls: unknown[] = []
    setTranslator((text, params, ctx) => {
      calls.push([text, params, ctx.locale])
      return text === 'Hello, {name}' ? `Hallo, ${String(params?.name)}` : undefined
    })
    expect(await json(await http.request('/greet'))).toEqual({
      text: 'Hallo, Ann',
      untouched: 'No translation',
    })
    expect(calls).toEqual([
      ['Hello, {name}', { name: 'Ann' }, 'de'],
      ['No translation', undefined, 'de'],
    ])
  })

  it('is the identity without a translator', async () => {
    const http = await boot(new MoostHttp())
    expect(await json(await http.request('/greet'))).toEqual({
      text: 'Hello, {name}',
      untouched: 'No translation',
    })
  })
})
