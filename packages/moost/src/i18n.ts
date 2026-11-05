import type { EventContext } from '@wooksjs/event-core'
import { current, useLocale, useLogger } from '@wooksjs/event-core'

/** What a translator gets besides the text: the event's locale and the event itself. */
export interface TTranslateContext {
  /** `useLocale().get()` of the event the text is translated for. */
  locale: string | undefined
  /** The event context — read anything else your policy needs from it. */
  event: EventContext
}

/**
 * The app's translator. `text` is a message id: an error/message code (`WF_EXPIRED`,
 * `MIN_LENGTH`, …) or a source text (gettext-style); `params` are the values it refers to.
 * Return the final text (with `params` filled in), or `undefined` when there is no translation.
 *
 * Moost never translates on its own: plug in any i18n library (i18next, FormatJS, …) or pass a
 * plain {@link TTranslations} map to {@link setTranslator}.
 */
export type TTranslate = (
  text: string,
  params: Record<string, unknown> | undefined,
  ctx: TTranslateContext,
) => string | undefined

/**
 * Translations as a plain map: `{ [locale]: { [id]: template } }`. Templates use `{name}`
 * placeholders, filled with {@link formatMessage}.
 */
export type TTranslations = Record<string, Record<string, string>>

/** `t(id, params?, fallback?)` — see {@link useTranslate}. */
type TTranslateFn = (id: string, params?: Record<string, unknown>, fallback?: string) => string

/** The translation of one event's locale — see {@link useTranslation}. */
export interface TTranslation {
  /** The event's locale. */
  locale: string
  /**
   * A memo key for anything derived from this translation: changes with every
   * {@link setTranslator} call and every {@link registerMessages} call that adds or changes a
   * template. `undefined` for a locale outside the translator's `locales` — don't memoize then.
   */
  key: string | undefined
  /** {@link useTranslate}'s `t`, bound to this translation. */
  t: TTranslateFn
  /**
   * The registered message templates ({@link registerMessages}) translated to `locale`, with
   * their `{name}` placeholders kept — only the ones that differ from the English template.
   * Memoized per {@link TTranslation.key}.
   */
  messages: () => Readonly<Record<string, string>>
}

interface TI18nState {
  translate?: TTranslate
  locales: readonly string[]
  /** Bumped by `setTranslator` and by a `registerMessages` that changes a template: the only invalidation. */
  generation: number
  /** A translator failure was logged (reset by `setTranslator`). */
  failureLogged?: boolean
  catalogs: WeakSet<object>
  /** code → English template, of every registered catalog. */
  templates: Map<string, string>
  /** `messages()` per key, of the current generation and registry. */
  memo: Map<string, Readonly<Record<string, string>>>
}

// Interned via Symbol.for: one translator and one message registry per process, even with
// duplicate moost copies (dual ESM/CJS, or several installs).
// Each field is initialised on its own: a copy finds what another (older) copy set up and
// adds only what it lacks.
const STATE = Symbol.for('moost.i18n')
const NO_LOCALES: readonly string[] = Object.freeze([])
const state = ((globalThis as { [STATE]?: Partial<TI18nState> })[STATE] ??= {}) as TI18nState
state.locales ??= NO_LOCALES
state.generation ??= 0
state.catalogs ??= new WeakSet()
state.templates ??= new Map()
state.memo ??= new Map()

/**
 * Registers the app's translator (process-wide), or removes it with `undefined`: a
 * {@link TTranslate} function or a {@link TTranslations} map. Load your languages before the
 * server listens, or call `setTranslator` again once they are loaded.
 *
 * `opts.locales` lists the locales the app serves, the first being the default (`MoostHttp`
 * negotiates `Accept-Language` against them). For a map they default to its keys — put the
 * source language first: `{ en: {}, de: {…} }`. Give a function translator `locales`, or
 * requests get a locale only from your own `resolveLocale` / `useLocale().set()`.
 *
 * @example
 * ```ts
 * setTranslator({ en: {}, de: { NAME_TAKEN: 'Name {name} ist vergeben' } })
 *
 * setTranslator(
 *   (id, params, { locale }) =>
 *     locale && i18next.exists(id, { lng: locale }) ? i18next.t(id, { ...params, lng: locale }) : undefined,
 *   { locales: ['en', 'de'] },
 * )
 * ```
 */
export function setTranslator(
  translate: TTranslate | TTranslations | undefined,
  opts?: { locales?: readonly string[] },
): void {
  const isMap = typeof translate === 'object'
  state.translate = isMap ? mapTranslator(translate) : translate
  const locales = opts?.locales ?? (isMap ? Object.keys(translate) : undefined)
  state.locales = translate && locales?.length ? Object.freeze([...locales]) : NO_LOCALES
  state.failureLogged = false
  newGeneration()
}

/** The registered translator (a map wrapped as a function), or `undefined`. */
export function getTranslator(): TTranslate | undefined {
  return state.translate
}

/** The locales of the registered translator, the default first (empty without a translator). */
export function getTranslatorLocales(): readonly string[] {
  return state.locales
}

/**
 * Registers message templates by code (`{ MIN_LENGTH: 'At least {min} characters' }`),
 * process-wide: the English text `useTranslate()` falls back to for the code, and the templates
 * {@link TTranslation.messages} serves translated. Registering the same catalog object again
 * does nothing; a later catalog wins for a code both define. A call that adds or changes a
 * template starts a new generation, like {@link setTranslator} ({@link TTranslation.key}
 * changes).
 */
export function registerMessages(catalog: Readonly<Record<string, string>>): void {
  if (state.catalogs.has(catalog)) {
    return
  }
  state.catalogs.add(catalog)
  let changed = false
  for (const code of Object.keys(catalog)) {
    if (state.templates.get(code) !== catalog[code]) {
      state.templates.set(code, catalog[code])
      changed = true
    }
  }
  if (changed) {
    newGeneration()
  }
}

/** The only invalidation: drops everything derived from the translator and the templates. */
function newGeneration(): void {
  state.generation++
  state.memo.clear()
}

const PLACEHOLDER = /\{(\w+)\}/g

/**
 * Fills `{name}` placeholders with `params` in one pass (arrays: items joined with `, `).
 * A placeholder without a param stays as it is; filled-in values are never filled again.
 */
export function formatMessage(template: string, params?: Record<string, unknown>): string {
  if (!params || !template.includes('{')) {
    return template
  }
  return template.replace(PLACEHOLDER, (match, name: string) => {
    const value = Object.hasOwn(params, name) ? params[name] : undefined
    if (value === undefined) {
      return match
    }
    return Array.isArray(value) ? value.map(String).join(', ') : String(value)
  })
}

/**
 * Returns `t(id, params?, fallback?)` for the current event (or `ctx`), in the event's locale
 * (`useLocale().get()`). `id` is a code or a source text. `t` returns:
 * - the translator's result, as is (it is final text: params are not filled again);
 * - else `fallback` as is — it is final too, never filled: pass already-filled English text
 *   (e.g. an error's message), or pass no fallback and {@link registerMessages} a template;
 * - else the code's registered template ({@link registerMessages}), or `id` itself, with
 *   `params` filled in ({@link formatMessage}).
 *
 * @example
 * ```ts
 * const t = useTranslate()
 * throw new HttpError(409, { message: t('NAME_TAKEN', { name }, `Name ${name} is taken`), code: 'NAME_TAKEN', params: { name } })
 * ```
 */
export function useTranslate(ctx?: EventContext): TTranslateFn {
  const event = ctx ?? current()
  let translateCtx: TTranslateContext | undefined
  return (id, params, fallback) => {
    const translate = state.translate
    const out = translate
      ? callTranslator(
          translate,
          id,
          params,
          (translateCtx ??= { locale: useLocale(event).get(), event }),
        )
      : undefined
    return out ?? untranslated(id, params, fallback)
  }
}

/** `t`'s text without a translation: `fallback` as is, else the filled template (or id). */
function untranslated(id: string, params?: Record<string, unknown>, fallback?: string): string {
  return fallback ?? formatMessage(state.templates.get(id) ?? id, params)
}

/**
 * The translation of the current event (or `ctx`): its locale, a memo key, `t` and the
 * translated message templates. `undefined` when no translator is registered or the event has
 * no locale — serve the source texts then.
 */
export function useTranslation(ctx?: EventContext): TTranslation | undefined {
  const translate = state.translate
  if (!translate) {
    return undefined
  }
  const event = ctx ?? current()
  const locale = useLocale(event).get()
  if (locale === undefined) {
    return undefined
  }
  const translateCtx: TTranslateContext = { locale, event }
  const generation = state.generation
  const key = state.locales.includes(locale) ? `${generation}:${locale}` : undefined
  const t: TTranslateFn = (id, params, fallback) =>
    callTranslator(translate, id, params, translateCtx) ?? untranslated(id, params, fallback)
  const messages = () => {
    // (a translation taken before the registry or the translator changed: not memoized)
    if (key === undefined || state.generation !== generation) {
      return translateTemplates(translate, translateCtx)
    }
    let out = state.memo.get(key)
    if (!out) {
      out = translateTemplates(translate, translateCtx)
      state.memo.set(key, out)
    }
    return out
  }
  return { locale, key, t, messages }
}

/** An error body's entry, as `translateErrorBody` reads it. */
interface TErrorEntry {
  path?: unknown
  message: string
  code?: unknown
  params?: Record<string, unknown>
  custom?: unknown
  details?: unknown
}

/**
 * Returns a translated copy of an error body (`{ message, code?, params?, errors? }`) in the
 * event's locale — the body itself when there is no translation ({@link useTranslation}).
 *
 * - each entry of `errors` (and of its entries' `details`): by its `code` (unless `custom`),
 *   else by its message text, its English `message` being the fallback;
 * - the top `message`: by `code` when the body has one; else, when it is the first entry's
 *   message (`path: message`), the first entry's translation; else by its text.
 *
 * `MoostHttp` applies it to every error body when it creates the HTTP app.
 */
export function translateErrorBody<
  T extends { message: string; code?: string; params?: Record<string, unknown>; errors?: unknown },
>(body: T, ctx?: EventContext): T {
  const translation = useTranslation(ctx)
  if (!translation) {
    return body
  }
  const { t } = translation
  const source: unknown[] | undefined = Array.isArray(body.errors) ? body.errors : undefined
  const errors = source && translateEntries(source, t)
  let message: string
  if (typeof body.code === 'string' && body.code) {
    message = t(body.code, body.params, body.message)
  } else if (source && errors && isEntry(source[0]) && body.message === topMessage(source[0])) {
    // (translateEntries keeps an entry an entry)
    message = topMessage(errors[0] as TErrorEntry)
  } else {
    message = t(body.message, body.params, body.message)
  }
  return errors ? { ...body, message, errors } : { ...body, message }
}

function mapTranslator(map: TTranslations): TTranslate {
  return (id, params, { locale }) => {
    const texts = locale !== undefined && Object.hasOwn(map, locale) ? map[locale] : undefined
    return texts && Object.hasOwn(texts, id) ? formatMessage(texts[id], params) : undefined
  }
}

/** The translator's text, `undefined` if it has none or throws (logged once per `setTranslator`). */
function callTranslator(
  translate: TTranslate,
  id: string,
  params: Record<string, unknown> | undefined,
  ctx: TTranslateContext,
): string | undefined {
  try {
    const out = translate(id, params, ctx)
    return typeof out === 'string' ? out : undefined
  } catch (error) {
    if (!state.failureLogged) {
      state.failureLogged = true
      useLogger('i18n', ctx.event).error(
        `The translator threw for "${id}" — using the untranslated text (logged once)`,
        error,
      )
    }
    return undefined
  }
}

/** The registered templates translated with placeholder params, if they differ. */
function translateTemplates(
  translate: TTranslate,
  ctx: TTranslateContext,
): Readonly<Record<string, string>> {
  const out: Record<string, string> = {}
  for (const [code, template] of state.templates) {
    let params: Record<string, string> | undefined
    for (const [placeholder, name] of template.matchAll(PLACEHOLDER)) {
      ;(params ??= {})[name] = placeholder
    }
    const translated = callTranslator(translate, code, params, ctx)
    if (translated !== undefined && translated !== template) {
      out[code] = translated
    }
  }
  return Object.freeze(out)
}

function isEntry(value: unknown): value is TErrorEntry {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { message?: unknown }).message === 'string'
  )
}

function translateEntries(entries: unknown[], t: TTranslateFn): unknown[] {
  return entries.map((entry) => {
    if (!isEntry(entry)) {
      return entry
    }
    const id =
      typeof entry.code === 'string' && entry.code && entry.custom !== true
        ? entry.code
        : entry.message
    const out: TErrorEntry = { ...entry, message: t(id, entry.params, entry.message) }
    if (Array.isArray(entry.details)) {
      out.details = translateEntries(entry.details, t)
    }
    return out
  })
}

function topMessage(entry: TErrorEntry): string {
  return typeof entry.path === 'string' && entry.path
    ? `${entry.path}: ${entry.message}`
    : entry.message
}
