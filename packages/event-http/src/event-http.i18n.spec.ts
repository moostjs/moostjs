import { createHttpApp, HttpError } from '@wooksjs/event-http'
import { clearGlobalWooks, Controller, Locale, Moost, setTranslator } from 'moost'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { Get } from './decorators'
import { MoostHttp } from './event-http'

/** The adapter under test, for in-process requests made from a handler. */
let current: MoostHttp | undefined

@Controller()
class I18nController {
  @Get('ssr')
  async ssr(@Locale() locale: string | undefined) {
    const inner = await current?.request('/locale')
    return { outer: locale ?? null, inner: inner ? await inner.json() : null }
  }

  @Get('plain')
  plain() {
    throw new Error('internal <b>detail</b>')
  }

  @Get('locale')
  locale(@Locale() locale: string | undefined) {
    return { locale: locale ?? null }
  }

  @Get('taken')
  taken() {
    throw new HttpError(409, {
      message: 'Name Ann is taken',
      code: 'NAME_TAKEN',
      params: { name: 'Ann' },
    })
  }

  @Get('invalid')
  invalid() {
    throw new HttpError(400, {
      message: 'name: Expected minimum length of 3 characters, got 1 characters',
      errors: [
        {
          path: 'name',
          message: 'Expected minimum length of 3 characters, got 1 characters',
          code: 'MIN_LENGTH',
          params: { min: 3, actual: 1 },
        },
      ],
    } as never)
  }
}

async function boot(http: MoostHttp) {
  current = http
  clearGlobalWooks()
  const app = new Moost()
  app.adapter(http)
  app.registerControllers(I18nController)
  await app.init()
  return http
}

function must(res: Response | null): Response {
  if (!res) {
    throw new Error('no route')
  }
  return res
}

const json = (res: Response | null) => must(res).json() as Promise<Record<string, unknown>>
const text = (res: Response | null) => must(res).text()

const MESSAGES = {
  en: {},
  de: {
    NAME_TAKEN: 'Name {name} ist vergeben',
    MIN_LENGTH: 'Mindestens {min} Zeichen',
  },
}

afterEach(() => {
  setTranslator(undefined)
})

describe('MoostHttp default locale policy (translator locales)', () => {
  it('negotiates Accept-Language against the translator locales and adds Vary', async () => {
    const http = await boot(new MoostHttp())
    setTranslator(MESSAGES) // read at request time: registered after the app is built
    const res = await http.request('/locale', { headers: { 'accept-language': 'de-CH, en;q=0.5' } })
    expect(res?.headers.get('vary')).toMatch(/accept-language/i)
    expect(await json(res)).toEqual({ locale: 'de' })
  })

  it('takes the first locale without an Accept-Language header', async () => {
    const http = await boot(new MoostHttp({}))
    setTranslator(MESSAGES, { locales: ['de', 'en'] })
    expect(await json(await http.request('/locale'))).toEqual({ locale: 'de' })
  })

  it('a single locale is the locale, with nothing to negotiate (no Vary)', async () => {
    const http = await boot(new MoostHttp())
    setTranslator({ en: {} })
    const res = await http.request('/locale', { headers: { 'accept-language': 'de' } })
    expect(await json(res)).toEqual({ locale: 'en' })
    expect(res?.headers.get('vary')).toBeNull()
  })

  it("the app's resolveLocale wins", async () => {
    const http = await boot(new MoostHttp({ resolveLocale: () => 'fr' }))
    setTranslator(MESSAGES)
    const res = await http.request('/locale', { headers: { 'accept-language': 'de' } })
    expect(await json(res)).toEqual({ locale: 'fr' })
    expect(res?.headers.get('vary')).toBeNull()
  })

  it('an in-process request (SSR self-fetch) inherits the default-policy locale', async () => {
    // no headers forwarded: the inner request reads the caller's locale, not the header
    const http = await boot(new MoostHttp({ forwardHeaders: false }))
    setTranslator(MESSAGES)
    const res = await http.request('/ssr', { headers: { 'accept-language': 'de' } })
    expect(await json(res)).toEqual({ outer: 'de', inner: { locale: 'de' } })
  })

  it('a function translator without locales: no default locale, no translation, no Vary', async () => {
    const translate = (id: string) => (id === 'NAME_TAKEN' ? 'Name vergeben' : undefined)
    let http = await boot(new MoostHttp())
    setTranslator(translate)
    const res = await http.request('/taken', { headers: { 'accept-language': 'de' } })
    const body = await json(res)
    expect(body.message).toBe('Name Ann is taken')
    expect(res?.headers.get('vary')).toBeNull()
    // with the app's own locale policy it translates
    http = await boot(new MoostHttp({ resolveLocale: () => 'de' }))
    const own = await json(await http.request('/taken'))
    expect(own.message).toBe('Name vergeben')
  })

  it('no translator: no locale and no Vary', async () => {
    const http = await boot(new MoostHttp())
    const res = await http.request('/locale', { headers: { 'accept-language': 'de' } })
    expect(await json(res)).toEqual({ locale: null })
    expect(res?.headers.get('vary')).toBeNull()
  })

  it('a passed-in WooksHttp is left alone', async () => {
    const http = await boot(new MoostHttp(createHttpApp()))
    setTranslator(MESSAGES)
    const res = await http.request('/locale', { headers: { 'accept-language': 'de' } })
    expect(await json(res)).toEqual({ locale: null })
    const taken = await json(await http.request('/taken', { headers: { 'accept-language': 'de' } }))
    expect(taken.message).toBe('Name Ann is taken')
  })
})

describe('MoostHttp default error-body translation', () => {
  it('translates a coded HttpError body', async () => {
    const http = await boot(new MoostHttp())
    setTranslator(MESSAGES)
    const res = await http.request('/taken', { headers: { 'accept-language': 'de' } })
    expect(res?.status).toBe(409)
    expect(await json(res)).toEqual({
      message: 'Name Ann ist vergeben',
      code: 'NAME_TAKEN',
      params: { name: 'Ann' },
      statusCode: 409,
      error: 'Conflict',
    })
  })

  it('translates a validation envelope (entries + top message)', async () => {
    const http = await boot(new MoostHttp())
    setTranslator(MESSAGES)
    const res = await http.request('/invalid', { headers: { 'accept-language': 'de' } })
    const body = (await json(res)) as { message: string; errors: { message: string }[] }
    expect(body.message).toBe('name: Mindestens 3 Zeichen')
    expect(body.errors[0].message).toBe('Mindestens 3 Zeichen')
  })

  it('pathPrefix: false sends the top message without the path prefix', async () => {
    const http = await boot(new MoostHttp())
    setTranslator(MESSAGES, { pathPrefix: false })
    const res = await http.request('/invalid', { headers: { 'accept-language': 'de' } })
    const body = (await json(res)) as { message: string; errors: { message: string }[] }
    expect(body.message).toBe('Mindestens 3 Zeichen')
    expect(body.errors[0].message).toBe('Mindestens 3 Zeichen')
  })

  it("the app's transformErrorBody sees the translated body", async () => {
    const seen: string[] = []
    const http = await boot(
      new MoostHttp({
        transformErrorBody: (body) => {
          seen.push(body.message)
          return { ...body, extra: true } as typeof body
        },
      }),
    )
    setTranslator(MESSAGES)
    const res = await http.request('/taken', { headers: { 'accept-language': 'de' } })
    expect(seen).toEqual(['Name Ann ist vergeben'])
    expect(await json(res)).toMatchObject({ message: 'Name Ann ist vergeben', extra: true })
  })

  it("a failing translation (throwing resolveLocale) still runs the app's transform; logged once", async () => {
    const error = vi.fn()
    const logger = { info() {}, warn() {}, error, debug() {}, log() {}, trace() {} }
    const http = await boot(
      new MoostHttp({
        logger,
        resolveLocale: () => {
          throw new Error('bad cookie')
        },
        transformErrorBody: (body) => ({ ...body, message: 'REDACTED', redacted: true }),
      }),
    )
    setTranslator(MESSAGES)
    for (let i = 0; i < 2; i++) {
      const body = await json(
        await http.request('/plain', { headers: { accept: 'application/json' } }),
      )
      expect(body).toMatchObject({ message: 'REDACTED', redacted: true, statusCode: 500 })
    }
    const translationLogs = error.mock.calls.filter((call) =>
      String(call[0]).includes('translation failed'),
    )
    expect(translationLogs).toHaveLength(1)
  })

  it('English request: the English message stays', async () => {
    const http = await boot(new MoostHttp())
    setTranslator(MESSAGES)
    const body = await json(await http.request('/taken', { headers: { 'accept-language': 'en' } }))
    expect(body.message).toBe('Name Ann is taken')
  })

  it('no translator: error pages and headers (no Vary) are byte-identical to a plain WooksHttp', async () => {
    for (const accept of [undefined, 'text/html', 'text/plain', 'application/json']) {
      const headers: Record<string, string> = accept ? { accept } : {}
      for (const path of ['/plain', '/taken']) {
        const plain = await boot(new MoostHttp(createHttpApp()))
        const a = await plain.request(path, { headers })
        const http = await boot(new MoostHttp())
        const b = await http.request(path, { headers: { ...headers, 'accept-language': 'de' } })
        expect(await text(b)).toBe(await text(a))
        expect([...(b?.headers ?? [])]).toEqual([...(a?.headers ?? [])])
        expect(b?.headers.get('vary')).toBeNull()
      }
    }
  })
})
