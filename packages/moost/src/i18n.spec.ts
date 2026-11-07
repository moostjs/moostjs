import type { EventContext } from '@wooksjs/event-core'
import { createEventContext, current, key as eventKey, useLocale } from '@wooksjs/event-core'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { TTranslate, TTranslateContext } from './i18n'
import {
  formatMessage,
  getTranslator,
  getTranslatorLocales,
  registerMessages,
  setTranslator,
  translateErrorBody,
  useTranslate,
  useTranslation,
} from './i18n'
import { createCaptureLogger } from './tests/capture-logger.artifacts'

const quiet = { info() {}, warn() {}, error() {}, debug() {}, log() {} }

/** Runs `fn` in a fresh event with `locale` (and `logger`), passing the event context. */
function withCtx<R>(
  locale: string | undefined,
  fn: (ctx: EventContext) => R,
  logger: typeof quiet = quiet,
): R {
  return createEventContext({ logger }, () => {
    useLocale().set(locale)
    return fn(current())
  })
}

function must<T>(value: T | undefined): T {
  if (value === undefined) {
    throw new Error('expected a value')
  }
  return value
}

afterEach(() => {
  setTranslator(undefined)
})

const DE = {
  GREET: 'Hallo, {name}',
  'Name taken': 'Name vergeben',
}

describe('formatMessage()', () => {
  it('fills {name} placeholders in one pass; missing params keep the placeholder', () => {
    expect(formatMessage('Hello, {name} ({age})', { name: 'Ann' })).toBe('Hello, Ann ({age})')
    expect(formatMessage('Hello, {name}')).toBe('Hello, {name}')
    expect(formatMessage('{a} and {b}', { a: '{b}', b: 'B' })).toBe('{b} and B')
    expect(formatMessage('one of {list}', { list: ['a', 'b'] })).toBe('one of a, b')
    expect(formatMessage('{constructor}', {})).toBe('{constructor}')
    expect(formatMessage('{x}', { x: undefined })).toBe('{x}')
  })
})

describe('setTranslator(map)', () => {
  it('looks ids up per locale, fills the template, and takes the locales from the map', () => {
    setTranslator({ en: {}, de: DE })
    expect(getTranslatorLocales()).toEqual(['en', 'de'])
    withCtx('de', () => {
      const t = useTranslate()
      expect(t('GREET', { name: 'Ann' })).toBe('Hallo, Ann')
      expect(t('Name taken')).toBe('Name vergeben')
      expect(t('Missing {x}', { x: 1 })).toBe('Missing 1')
      expect(t('constructor')).toBe('constructor')
    })
    withCtx('fr', () => {
      expect(useTranslate()('GREET', { name: 'Ann' }, 'Hello, Ann')).toBe('Hello, Ann')
    })
  })

  it('opts.locales replaces the map keys', () => {
    setTranslator({ de: DE, en: {} }, { locales: ['en', 'de', 'fr'] })
    expect(getTranslatorLocales()).toEqual(['en', 'de', 'fr'])
  })

  it('getTranslator() returns a TTranslate for a map', () => {
    setTranslator({ en: {}, de: DE })
    const translate = must(getTranslator())
    withCtx('de', (event) => {
      expect(translate('GREET', { name: 'Bo' }, { locale: 'de', event })).toBe('Hallo, Bo')
    })
  })
})

describe('setTranslator(function)', () => {
  it('uses the translator result as final text (never re-filled)', () => {
    const calls: unknown[] = []
    setTranslator((id, params, { locale }) => {
      calls.push([id, params, locale])
      return id === 'GREET' ? 'Hallo, {name}' : undefined
    })
    expect(getTranslatorLocales()).toEqual([])
    withCtx('de', () => {
      const t = useTranslate()
      expect(t('GREET', { name: 'Ann' })).toBe('Hallo, {name}')
      expect(t('Other {x}', { x: 1 })).toBe('Other 1')
    })
    expect(calls).toEqual([
      ['GREET', { name: 'Ann' }, 'de'],
      ['Other {x}', { x: 1 }, 'de'],
    ])
  })

  it('falls back after a throwing translator and logs once', () => {
    const { logger, errors } = createCaptureLogger()
    setTranslator(() => {
      throw new Error('boom')
    })
    withCtx(
      'de',
      () => {
        const t = useTranslate()
        expect(t('A {x}', { x: 1 })).toBe('A 1')
        expect(t('CODE', undefined, 'Fallback text')).toBe('Fallback text')
      },
      logger,
    )
    registerMessages({ I18N_SPEC_LOG_ONCE: 'Once' }) // a new template: not a new translator
    withCtx('de', () => expect(useTranslate()('B')).toBe('B'), logger)
    expect(errors).toHaveLength(1)
    expect(errors[0]).toMatch(/translator/i)
  })
})

describe('useTranslate() fill contract', () => {
  it('without a translator fills the registered template, else the id, in one pass', () => {
    registerMessages({ I18N_SPEC_MIN: 'At least {min} characters' })
    withCtx('de', () => {
      const t = useTranslate()
      expect(t('I18N_SPEC_MIN', { min: 3 })).toBe('At least 3 characters')
      // a user value containing a placeholder is not interpolated again
      expect(t('Hello {name}', { name: '{x}', x: 'BAD' })).toBe('Hello {x}')
      // a fallback is already-filled text: returned as is
      expect(t('I18N_SPEC_MIN', { min: 3 }, 'Too short: {min}')).toBe('Too short: {min}')
    })
  })

  it('a translator returning undefined falls back the same way', () => {
    setTranslator(() => undefined)
    withCtx('de', () => {
      expect(useTranslate()('Hello {name}', { name: '{x}', x: 'BAD' })).toBe('Hello {x}')
    })
  })
})

describe('useTranslation()', () => {
  it('is undefined without a translator or without a locale', () => {
    withCtx('de', () => expect(useTranslation()).toBeUndefined())
    setTranslator({ en: {}, de: DE })
    withCtx(undefined, () => expect(useTranslation()).toBeUndefined())
  })

  it('key = generation:locale for a listed locale, undefined otherwise; setTranslator bumps it', () => {
    setTranslator({ en: {}, de: DE })
    const first = withCtx('de', () => must(useTranslation()).key)
    expect(first).toMatch(/^\d+:de$/)
    expect(withCtx('fr', () => must(useTranslation()).key)).toBeUndefined()
    expect(withCtx('fr', () => must(useTranslation()).locale)).toBe('fr')
    setTranslator({ en: {}, de: DE })
    const second = withCtx('de', () => must(useTranslation()).key)
    expect(second).toMatch(/:de$/)
    expect(second).not.toBe(first)
    setTranslator((id) => id, { locales: ['de'] })
    expect(withCtx('de', () => must(useTranslation()).key)).not.toBe(second)
  })

  it('a function translator without locales: no key, a translation only where the event has a locale', () => {
    setTranslator((id) => (id === 'GREET' ? 'Hallo' : undefined))
    expect(getTranslatorLocales()).toEqual([])
    withCtx(undefined, () => expect(useTranslation()).toBeUndefined())
    const translation = withCtx('de', () => must(useTranslation()))
    expect(translation.key).toBeUndefined()
    expect(translation.t('GREET')).toBe('Hallo')
  })

  it('t() translates in the event locale', () => {
    setTranslator({ en: {}, de: DE })
    expect(withCtx('de', () => must(useTranslation()).t('GREET', { name: 'Ann' }))).toBe(
      'Hallo, Ann',
    )
  })
})

describe('registerMessages() + messages()', () => {
  const CATALOG = Object.freeze({
    I18N_SPEC_LEN: 'At least {min} characters, got {actual}',
    I18N_SPEC_REQ: 'Must not be empty',
    I18N_SPEC_SAME: 'Same',
  })

  it('serves translated TEMPLATES via placeholder params (i18next-style {{x}} translator)', () => {
    registerMessages(CATALOG)
    registerMessages(CATALOG) // idempotent
    const resources: Record<string, string> = {
      I18N_SPEC_LEN: 'Mindestens {{min}} Zeichen, erhalten {{actual}}',
      I18N_SPEC_REQ: 'Darf nicht leer sein',
      I18N_SPEC_SAME: 'Same',
    }
    const seen: unknown[] = []
    // a fake i18next: own {{x}} interpolation, unknown keys → undefined
    const i18nextLike: TTranslate = (id, params) => {
      if (id.startsWith('I18N_SPEC_')) {
        seen.push([id, params])
      }
      const tpl = resources[id]
      return tpl === undefined
        ? undefined
        : tpl.replace(/\{\{(\w+)\}\}/g, (_, k: string) => String(params?.[k] ?? ''))
    }
    setTranslator(i18nextLike, { locales: ['en', 'de'] })
    const messages = withCtx('de', () => must(useTranslation()).messages())
    expect(messages.I18N_SPEC_LEN).toBe('Mindestens {min} Zeichen, erhalten {actual}')
    expect(messages.I18N_SPEC_REQ).toBe('Darf nicht leer sein')
    expect('I18N_SPEC_SAME' in messages).toBe(false) // same as English: not served
    expect(seen).toContainEqual(['I18N_SPEC_LEN', { min: '{min}', actual: '{actual}' }])
    expect(Object.isFrozen(messages)).toBe(true)

    // memoized per key: no new translator calls, same object
    seen.length = 0
    expect(withCtx('de', () => must(useTranslation()).messages())).toBe(messages)
    expect(seen).toEqual([])
  })

  it('serves map templates as they are', () => {
    registerMessages(CATALOG)
    setTranslator({ en: {}, de: { I18N_SPEC_LEN: 'Mindestens {min} Zeichen' } })
    const messages = withCtx('de', () => must(useTranslation()).messages())
    expect(messages.I18N_SPEC_LEN).toBe('Mindestens {min} Zeichen')
    expect(withCtx('en', () => 'I18N_SPEC_LEN' in must(useTranslation()).messages())).toBe(false)
  })

  it('recomputes after setTranslator and after a new catalog', () => {
    registerMessages(CATALOG)
    setTranslator({ en: {}, de: { I18N_SPEC_REQ: 'Leer' } })
    const first = withCtx('de', () => must(useTranslation()).messages())
    expect(first.I18N_SPEC_REQ).toBe('Leer')
    setTranslator({ en: {}, de: { I18N_SPEC_REQ: 'Pflichtfeld' } })
    expect(withCtx('de', () => must(useTranslation()).messages()).I18N_SPEC_REQ).toBe('Pflichtfeld')
    registerMessages({ I18N_SPEC_LATE: 'Late' })
    setTranslator({ en: {}, de: { I18N_SPEC_LATE: 'Spät' } })
    const before = withCtx('de', () => must(useTranslation()).messages())
    registerMessages({ I18N_SPEC_LATER: 'Later' })
    const after = withCtx('de', () => must(useTranslation()).messages())
    expect(after).not.toBe(before)
    expect(after.I18N_SPEC_LATE).toBe('Spät')
  })

  it('a registration that adds or changes a template changes the key; a repeated one does not', () => {
    registerMessages(CATALOG)
    setTranslator({ en: {}, de: { I18N_SPEC_KEY: 'Schlüssel' } })
    const key = () => withCtx('de', () => must(useTranslation()).key)
    const first = key()
    const stale = withCtx('de', () => must(useTranslation()))
    registerMessages(CATALOG) // same object
    registerMessages({ I18N_SPEC_REQ: 'Must not be empty' }) // same templates
    expect(key()).toBe(first)
    registerMessages({ I18N_SPEC_KEY: 'Key' })
    const second = key()
    expect(second).not.toBe(first)
    expect(withCtx('de', () => must(useTranslation()).messages()).I18N_SPEC_KEY).toBe('Schlüssel')
    registerMessages({ I18N_SPEC_KEY: 'Key, reworded' })
    expect(key()).not.toBe(second)
    // a translation taken before the registration still answers, without being memoized
    expect(stale.messages().I18N_SPEC_KEY).toBe('Schlüssel')
    expect(stale.messages()).not.toBe(stale.messages())
  })

  it('is computed (not memoized) for a locale outside the list', () => {
    registerMessages(CATALOG)
    let calls = 0
    setTranslator(
      (id) => {
        calls += id === 'I18N_SPEC_REQ' ? 1 : 0
        return id === 'I18N_SPEC_REQ' ? 'Vide' : undefined
      },
      { locales: ['en'] },
    )
    expect(withCtx('fr', () => must(useTranslation()).messages()).I18N_SPEC_REQ).toBe('Vide')
    withCtx('fr', () => must(useTranslation()).messages())
    expect(calls).toBe(2)
  })

  it("completes another copy's partial state instead of crashing on it", async () => {
    const slot = globalThis as Record<symbol, unknown>
    const sym = Symbol.for('moost.i18n')
    const saved = slot[sym]
    slot[sym] = { locales: [], generation: 3 } // as an older copy might have left it
    try {
      vi.resetModules()
      const fresh = await import('./i18n')
      fresh.registerMessages({ I18N_SPEC_PARTIAL: 'Partial' })
      fresh.setTranslator({ en: {}, de: { I18N_SPEC_PARTIAL: 'Teilweise' } })
      const messages = withCtx('de', () => must(fresh.useTranslation()).messages())
      expect(messages.I18N_SPEC_PARTIAL).toBe('Teilweise')
    } finally {
      slot[sym] = saved
    }
  })

  it('shares the registry across module copies (Symbol.for on globalThis)', () => {
    registerMessages({ I18N_SPEC_SHARED: 'Shared' })
    const state = (globalThis as Record<symbol, { templates: Map<string, string> }>)[
      Symbol.for('moost.i18n')
    ]
    expect(state.templates.get('I18N_SPEC_SHARED')).toBe('Shared')
  })
})

describe('setTranslator({ scope })', () => {
  const tenantKey = eventKey<string | undefined>('i18n.spec.tenant')
  const scope = () => current().get(tenantKey)
  const CATALOG = Object.freeze({ I18N_SPEC_ORDER: 'Order' })
  const WORDING: Record<string, string> = { acme: 'Auftrag', globex: 'Bestellvorgang' }

  /** Runs `fn` in a fresh event with `locale` and `tenant`. */
  function withTenant<R>(
    locale: string | undefined,
    tenant: string | undefined,
    fn: (ctx: EventContext) => R,
  ): R {
    return withCtx(locale, (ctx) => {
      ctx.set(tenantKey, tenant)
      return fn(ctx)
    })
  }

  /** A translator wording I18N_SPEC_ORDER per tenant (German only), counting its calls. */
  function tenantTranslator() {
    const calls: unknown[] = []
    const translate: TTranslate = (id, _params, { locale, scope: tenant }) => {
      if (id !== 'I18N_SPEC_ORDER') {
        return undefined
      }
      calls.push([locale, tenant])
      return locale === 'de' ? (tenant === undefined ? 'Bestellung' : WORDING[tenant]) : undefined
    }
    return { translate, calls }
  }

  it('passes the scope to the translator (t, useTranslate, translateErrorBody)', () => {
    const seen: TTranslateContext[] = []
    setTranslator(
      (_id, _params, ctx) => {
        seen.push(ctx)
        return undefined
      },
      { locales: ['en', 'de'], scope },
    )
    withTenant('de', 'acme', (ctx) => {
      must(useTranslation()).t('A')
      useTranslate()('B')
      translateErrorBody({ message: 'C' })
      translateErrorBody({ message: 'D', errors: [{ path: 'a', message: 'E', code: 'F' }] })
      expect(seen).toEqual([
        { locale: 'de', scope: 'acme', event: ctx },
        { locale: 'de', scope: 'acme', event: ctx },
        { locale: 'de', scope: 'acme', event: ctx },
        { locale: 'de', scope: 'acme', event: ctx, path: 'a', code: 'F' },
        { locale: 'de', scope: 'acme', event: ctx },
      ])
    })
    seen.length = 0
    withTenant('de', undefined, (ctx) => {
      useTranslate()('D')
      expect(seen).toEqual([{ locale: 'de', event: ctx }])
      expect('scope' in seen[0]).toBe(false)
    })
  })

  it('combines with pathPrefix: false (scoped wording, no prefix)', () => {
    const { translate } = tenantTranslator()
    setTranslator(translate, { locales: ['en', 'de'], scope, pathPrefix: false })
    const body = {
      statusCode: 400,
      message: 'order: Order',
      errors: [{ path: 'order', message: 'Order', code: 'I18N_SPEC_ORDER' }],
    }
    expect(withTenant('de', 'acme', (ctx) => translateErrorBody(body, ctx)).message).toBe('Auftrag')
    expect(withTenant('de', undefined, (ctx) => translateErrorBody(body, ctx)).message).toBe(
      'Bestellung',
    )
  })

  it('partitions memoized messages per scope: no cross-talk, each memoized', () => {
    registerMessages(CATALOG)
    const { translate, calls } = tenantTranslator()
    setTranslator(translate, { locales: ['en', 'de'], scope })
    const acme = withTenant('de', 'acme', () => must(useTranslation()).messages())
    const globex = withTenant('de', 'globex', () => must(useTranslation()).messages())
    const shared = withTenant('de', undefined, () => must(useTranslation()).messages())
    expect(acme.I18N_SPEC_ORDER).toBe('Auftrag')
    expect(globex.I18N_SPEC_ORDER).toBe('Bestellvorgang')
    expect(shared.I18N_SPEC_ORDER).toBe('Bestellung')
    calls.length = 0
    expect(withTenant('de', 'acme', () => must(useTranslation()).messages())).toBe(acme)
    expect(withTenant('de', 'globex', () => must(useTranslation()).messages())).toBe(globex)
    expect(withTenant('de', undefined, () => must(useTranslation()).messages())).toBe(shared)
    expect(calls).toEqual([])
  })

  it('key = generation:locale:scope, partition = locale:scope; unscoped events as before', () => {
    setTranslator({ en: {}, de: DE }, { scope })
    const acme = withTenant('de', 'acme', () => must(useTranslation()))
    expect(acme.key).toMatch(/^\d+:de:acme$/)
    expect(acme.partition).toBe('de:acme')
    const shared = withTenant('de', undefined, () => must(useTranslation()))
    expect(shared.key).toMatch(/^\d+:de$/)
    expect(shared.partition).toBe('de')
    expect(shared.key?.split(':')[0]).toBe(acme.key?.split(':')[0])
    // a locale outside the list: no key, scoped or not
    const fr = withTenant('fr', 'acme', () => must(useTranslation()))
    expect(fr.key).toBeUndefined()
    expect(fr.partition).toBe('fr:acme')
  })

  it('without a scope option (or after one is dropped): partition = locale, key = generation:locale', () => {
    setTranslator({ en: {}, de: DE }, { scope })
    setTranslator({ en: {}, de: DE })
    const translation = withTenant('de', 'acme', () => must(useTranslation()))
    expect(translation.partition).toBe('de')
    expect(translation.key).toMatch(/^\d+:de$/)
  })

  it('a finite number names a scope; other non-strings are the shared wording', () => {
    let value: unknown
    setTranslator({ en: {}, de: DE }, { scope: () => value as string | number | undefined })
    const partition = () => withCtx('de', () => must(useTranslation()).partition)
    value = 42
    expect(partition()).toBe('de:42')
    for (value of [Number.NaN, Infinity, {}, null, true]) {
      expect(partition()).toBe('de')
    }
  })

  it('reads the scope per translation taken, in the given event (even outside it)', () => {
    setTranslator({ en: {}, de: DE }, { scope })
    const ctx = withTenant('de', undefined, (event) => {
      expect(must(useTranslation()).partition).toBe('de')
      event.set(tenantKey, 'acme')
      expect(must(useTranslation()).partition).toBe('de:acme')
      return event
    })
    expect(must(useTranslation(ctx)).partition).toBe('de:acme')
  })

  it('memoizes the first 32 scopes of a generation; later ones are computed per call', () => {
    registerMessages(CATALOG)
    const { translate, calls } = tenantTranslator()
    setTranslator(translate, { locales: ['de'], scope })
    for (let i = 0; i < 32; i++) {
      expect(withTenant('de', `t${i}`, () => must(useTranslation()).key)).toBeDefined()
    }
    const late = withTenant('de', 't32', () => must(useTranslation()))
    expect(late.key).toBeUndefined()
    expect(late.partition).toBe('de:t32')
    calls.length = 0
    expect(late.t('I18N_SPEC_ORDER')).toBe('Order') // asked with its scope, no wording for it
    expect(calls).toEqual([['de', 't32']])
    calls.length = 0
    late.messages()
    late.messages()
    expect(calls).toEqual([
      ['de', 't32'],
      ['de', 't32'],
    ])
    // admitted scopes and the unscoped partition keep their keys
    expect(withTenant('de', 't0', () => must(useTranslation()).key)).toMatch(/:de:t0$/)
    expect(withTenant('de', undefined, () => must(useTranslation()).key)).toMatch(/^\d+:de$/)
    // a new generation starts over
    setTranslator(translate, { locales: ['de'], scope })
    expect(withTenant('de', 't32', () => must(useTranslation()).key)).toMatch(/:de:t32$/)
  })

  it('a throwing scope function: unscoped, not memoized, logged once', () => {
    const { logger, errors } = createCaptureLogger()
    setTranslator(
      { en: {}, de: DE },
      {
        scope: () => {
          throw new Error('no tenant')
        },
      },
    )
    withCtx(
      'de',
      () => {
        const translation = must(useTranslation())
        expect(translation.key).toBeUndefined()
        expect(translation.partition).toBe('de')
        expect(translation.t('Name taken')).toBe('Name vergeben')
        expect(useTranslate()('Name taken')).toBe('Name vergeben')
      },
      logger,
    )
    expect(errors).toHaveLength(1)
    expect(errors[0]).toMatch(/scope/i)
  })
})

describe('translateErrorBody()', () => {
  const de: Record<string, string> = {
    MIN_LENGTH: 'Mindestens {min} Zeichen',
    'Name is reserved': 'Name ist reserviert',
    'Hand-made entry': 'Handgemacht',
    UNION: 'Kein Typ passt',
    NOT_FOUND: 'Nicht gefunden: {id}',
    CONFLICT: 'Konflikt',
    'Something broke': 'Etwas ist kaputt',
  }

  it('returns the body itself without a translation', () => {
    const body = { statusCode: 400, message: 'x', errors: [{ path: 'a', message: 'b' }] }
    expect(withCtx('de', (ctx) => translateErrorBody(body, ctx))).toBe(body)
    setTranslator({ en: {}, de })
    expect(withCtx(undefined, (ctx) => translateErrorBody(body, ctx))).toBe(body)
  })

  it('translates entries by code / custom text / text, recursing into details, and the ValidatorError top message', () => {
    setTranslator({ en: {}, de })
    const errors = [
      {
        path: 'name',
        message: 'Expected minimum length of 3 characters, got 1 characters',
        code: 'MIN_LENGTH',
        params: { min: 3, actual: 1 },
      },
      { path: 'nick', message: 'Name is reserved', code: 'CUSTOM', custom: true },
      { path: 'x', message: 'Hand-made entry' },
      {
        path: 'u',
        message: 'Value does not match any of the allowed types: [string(0)]',
        code: 'UNION',
        details: [
          { path: 'u', message: 'Expected minimum length', code: 'MIN_LENGTH', params: { min: 2 } },
        ],
      },
      { path: 'y', message: 'Untranslated', code: 'NO_SUCH_CODE' },
    ]
    const body = {
      statusCode: 400,
      error: 'Bad Request',
      message: 'name: Expected minimum length of 3 characters, got 1 characters',
      errors,
    }
    const snapshot = structuredClone(body)
    const out = withCtx('de', (ctx) => translateErrorBody(body, ctx))
    expect(out).toEqual({
      statusCode: 400,
      error: 'Bad Request',
      message: 'name: Mindestens 3 Zeichen',
      errors: [
        { ...errors[0], message: 'Mindestens 3 Zeichen' },
        { ...errors[1], message: 'Name ist reserviert' },
        { ...errors[2], message: 'Handgemacht' },
        {
          ...errors[3],
          message: 'Kein Typ passt',
          details: [{ ...errors[3].details?.[0], message: 'Mindestens 2 Zeichen' }],
        },
        errors[4],
      ],
    })
    expect(Object.keys(out)).toEqual(Object.keys(body))
    expect(body).toEqual(snapshot) // the input is not mutated
  })

  it('a root-path first entry gives the bare translated message', () => {
    setTranslator({ en: {}, de })
    const body = {
      statusCode: 400,
      message: 'Expected minimum length of 3 characters',
      errors: [
        {
          path: '',
          message: 'Expected minimum length of 3 characters',
          code: 'MIN_LENGTH',
          params: { min: 3 },
        },
      ],
    }
    expect(withCtx('de', (ctx) => translateErrorBody(body, ctx)).message).toBe(
      'Mindestens 3 Zeichen',
    )
  })

  it('a body code translates the top message by code (English message as fallback)', () => {
    setTranslator({ en: {}, de })
    const coded = { statusCode: 404, message: 'Not found: 7', code: 'NOT_FOUND', params: { id: 7 } }
    expect(withCtx('de', (ctx) => translateErrorBody(coded, ctx)).message).toBe('Nicht gefunden: 7')
    // with errors too: the code wins over the first-entry rule (a DbError envelope)
    const db = {
      statusCode: 409,
      message: 'Unique violation',
      code: 'CONFLICT',
      errors: [{ path: 'email', message: 'Unique violation', code: 'UNIQUE' }],
    }
    expect(withCtx('de', (ctx) => translateErrorBody(db, ctx)).message).toBe('Konflikt')
    const unknown = { statusCode: 409, message: 'Exact {x} text', code: 'NOPE', params: { x: 1 } }
    expect(withCtx('de', (ctx) => translateErrorBody(unknown, ctx)).message).toBe('Exact {x} text')
  })

  it('an uncoded top message that is not the first entry is translated as text', () => {
    setTranslator({ en: {}, de })
    const body = {
      statusCode: 500,
      message: 'Something broke',
      errors: [{ path: 'a', message: 'Hand-made entry' }],
    }
    const out = withCtx('de', (ctx) => translateErrorBody(body, ctx))
    expect(out.message).toBe('Etwas ist kaputt')
    expect(out.errors[0].message).toBe('Handgemacht')
    const plain = { statusCode: 500, message: 'Untranslated {x}', params: { x: 1 } }
    expect(withCtx('de', (ctx) => translateErrorBody(plain, ctx)).message).toBe('Untranslated {x}')
  })

  it('passes each entry its path, code and custom (details too); a coded top message its code', () => {
    const seen: [string, TTranslateContext][] = []
    setTranslator(
      (id, _params, ctx) => {
        seen.push([id, ctx])
        return ctx.path === 'items.0.qty' && ctx.code === 'REQUIRED' ? 'Menge fehlt' : undefined
      },
      { locales: ['en', 'de'] },
    )
    const body = {
      statusCode: 400,
      message: 'items.0.qty: Required',
      errors: [
        { path: 'items.0.qty', message: 'Required', code: 'REQUIRED' },
        { path: 'name', message: 'Own text', code: 'CUSTOM', custom: true },
        { path: '', message: 'Root entry' },
        { message: 'No path', details: [{ path: 'u.0', message: 'Inner', code: 'TYPE' }] },
      ],
    }
    withCtx('de', (ctx) => {
      const out = translateErrorBody(body, ctx)
      expect(out.message).toBe('items.0.qty: Menge fehlt')
      expect(out.errors[0].message).toBe('Menge fehlt')
      expect(seen).toEqual([
        ['REQUIRED', { locale: 'de', event: ctx, path: 'items.0.qty', code: 'REQUIRED' }],
        ['Own text', { locale: 'de', event: ctx, path: 'name', code: 'CUSTOM', custom: true }],
        ['Root entry', { locale: 'de', event: ctx, path: '' }],
        ['No path', { locale: 'de', event: ctx }],
        ['TYPE', { locale: 'de', event: ctx, path: 'u.0', code: 'TYPE' }],
      ])
      expect('path' in seen[3][1]).toBe(false)
      seen.length = 0
      translateErrorBody({ statusCode: 404, message: 'Gone', code: 'GONE' }, ctx)
      translateErrorBody({ statusCode: 500, message: 'Plain' }, ctx)
      expect(seen).toEqual([
        ['GONE', { locale: 'de', event: ctx, code: 'GONE' }],
        ['Plain', { locale: 'de', event: ctx }],
      ])
      // useTranslate() and the templates carry no entry fields
      seen.length = 0
      useTranslate()('X')
      expect(seen).toEqual([['X', { locale: 'de', event: ctx }]])
    })
  })

  it('pathPrefix: false drops the path prefix of the first-entry top message; default keeps it', () => {
    const body = {
      statusCode: 400,
      message: 'name: Expected minimum length of 3 characters',
      errors: [
        {
          path: 'name',
          message: 'Expected minimum length of 3 characters',
          code: 'MIN_LENGTH',
          params: { min: 3 },
        },
      ],
    }
    setTranslator({ en: {}, de })
    expect(withCtx('de', (ctx) => translateErrorBody(body, ctx)).message).toBe(
      'name: Mindestens 3 Zeichen',
    )
    setTranslator({ en: {}, de }, { pathPrefix: true })
    expect(withCtx('de', (ctx) => translateErrorBody(body, ctx)).message).toBe(
      'name: Mindestens 3 Zeichen',
    )
    setTranslator({ en: {}, de }, { pathPrefix: false })
    const out = withCtx('de', (ctx) => translateErrorBody(body, ctx))
    expect(out.message).toBe('Mindestens 3 Zeichen')
    expect(out.errors[0]).toEqual({ ...body.errors[0], message: 'Mindestens 3 Zeichen' })
    // untranslated entry: its English text, still without the prefix
    const other = { ...body, errors: [{ ...body.errors[0], code: 'NO_SUCH_CODE' }] }
    expect(withCtx('de', (ctx) => translateErrorBody(other, ctx)).message).toBe(
      'Expected minimum length of 3 characters',
    )
    // only the first-entry rule: a coded or unrelated top message is unaffected
    const coded = { ...body, code: 'CONFLICT' }
    expect(withCtx('de', (ctx) => translateErrorBody(coded, ctx)).message).toBe('Konflikt')
    // the option belongs to its setTranslator call
    setTranslator({ en: {}, de })
    expect(withCtx('de', (ctx) => translateErrorBody(body, ctx)).message).toBe(
      'name: Mindestens 3 Zeichen',
    )
  })

  it('pathPrefix: false with several entries, a root first entry, and no locale', () => {
    setTranslator({ en: {}, de }, { pathPrefix: false })
    const several = {
      statusCode: 400,
      message: 'name: Name is reserved',
      errors: [
        { path: 'name', message: 'Name is reserved' },
        { path: 'nick', message: 'Hand-made entry' },
      ],
    }
    const out = withCtx('de', (ctx) => translateErrorBody(several, ctx))
    expect(out.message).toBe('Name ist reserviert') // the first entry's text only
    expect(out.errors.map((e) => e.message)).toEqual(['Name ist reserviert', 'Handgemacht'])
    const root = {
      statusCode: 400,
      message: 'Name is reserved',
      errors: [{ path: '', message: 'Name is reserved' }],
    }
    expect(withCtx('de', (ctx) => translateErrorBody(root, ctx)).message).toBe(
      'Name ist reserviert',
    )
    // an event without a locale: the body is not touched, prefix included
    expect(withCtx(undefined, (ctx) => translateErrorBody(several, ctx))).toBe(several)
  })

  it('keeps non-object entries and non-array errors as they are', () => {
    setTranslator({ en: {}, de })
    const body = { statusCode: 400, message: 'Something broke', errors: ['raw', null] as unknown[] }
    const out = withCtx('de', (ctx) => translateErrorBody(body, ctx))
    expect(out.errors).toEqual(['raw', null])
    const odd = { statusCode: 400, message: 'Something broke', errors: 'nope' }
    expect(withCtx('de', (ctx) => translateErrorBody(odd, ctx)).errors).toBe('nope')
  })
})
