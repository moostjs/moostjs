import type { EventContext } from '@wooksjs/event-core'
import { current, run, tryGetCurrent, useLocale, useLogger } from '@wooksjs/event-core'

/**
 * What a translator gets besides the text: the event's locale, its scope and the event itself —
 * plus, when an error body is translated ({@link translateErrorBody}), the entry's `path` and
 * `code`.
 */
export interface TTranslateContext {
  /** `useLocale().get()` of the event the text is translated for. */
  locale: string | undefined
  /**
   * The event's translation scope ({@link TTranslatorOptions.scope}) — e.g. a tenant whose
   * wording differs. `undefined`: the shared wording.
   */
  scope?: string
  /** The event context — read anything else your policy needs from it. */
  event: EventContext
  /**
   * The field path (`'items.0.name'`, `''` for the root) of the error entry being
   * translated — word a message per field. Only set by {@link translateErrorBody}, for its
   * `errors` entries (and their `details`); error bodies are never memoized, while the memoized
   * {@link TTranslation.messages} never carry a path.
   */
  path?: string
  /**
   * The code of the error entry (or error body) being translated — also when `text` is the
   * entry's own message (an entry marked `custom`, or one translated by its text). Only set by
   * {@link translateErrorBody}.
   */
  code?: string
  /**
   * `true` when the error entry carries the app's own message (`custom: true`, e.g. from
   * `@expect.message`): `text` is that message — keep it unless you translate it as text. Only
   * set by {@link translateErrorBody}.
   */
  custom?: boolean
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

/** The options of {@link setTranslator}. */
export interface TTranslatorOptions {
  /** The locales the app serves, the default first. For a map: its keys by default. */
  locales?: readonly string[]
  /**
   * The event's translation scope, for wording that differs by more than the locale (per
   * tenant, brand, user group, …). Called in the event's context each time a translation is
   * taken — keep it cheap. Its result is passed to the translator ({@link TTranslateContext.scope})
   * and partitions everything memoized per translation ({@link TTranslation.key}); a finite
   * number counts as its string, and `undefined` (or any other value) is the shared, unscoped
   * wording. The translator must return the same text for the same (id, params, locale, scope).
   *
   * Derive it from a validated value (the authenticated principal's tenant), never straight from
   * request input: only the first 32 scopes seen per generation get a {@link TTranslation.key}.
   */
  scope?: () => string | number | undefined
  /**
   * `false`: a translated error body's top `message` that repeats its first entry is just that
   * entry's text, without the `path: ` prefix ({@link translateErrorBody}) — also when the entry
   * has no translation (its English text). Bodies of events without a locale are not touched.
   * Default `true`: `path: <translated>`, like the untranslated message.
   */
  pathPrefix?: boolean
}

/** `t(id, params?, fallback?)` — see {@link useTranslate}. */
type TTranslateFn = (id: string, params?: Record<string, unknown>, fallback?: string) => string

/** The translation of one event's locale — see {@link useTranslation}. */
export interface TTranslation {
  /** The event's locale. */
  locale: string
  /**
   * What to index memoized results by: the locale, plus the event's scope when it has one
   * ({@link TTranslatorOptions.scope}). Keep one entry per partition, replaced when
   * {@link TTranslation.key} changes.
   */
  partition: string
  /**
   * A memo key for anything derived from this translation: the locale, the scope (if any) and
   * the generation — changes with every {@link setTranslator} call and every
   * {@link registerMessages} call that adds or changes a template. `undefined` for a locale
   * outside the translator's `locales`, or a scope past the cap ({@link TTranslatorOptions.scope})
   * — don't memoize then.
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
  /** `opts.scope` of the `setTranslator` call that registered `translate`. */
  scoping?: { translate: TTranslate | undefined; get: () => string | number | undefined }
  /** The translator registered with `opts.pathPrefix: false` (`undefined`: none). */
  noPathPrefix?: TTranslate
  /**
   * The scopes given memo keys in `generation` (at most {@link MAX_SCOPES}). Tagged rather than
   * cleared by `newGeneration`: an older moost copy bumps the generation without knowing of it.
   */
  admittedScopes?: { generation: number; names: Set<string> }
  locales: readonly string[]
  /** Bumped by `setTranslator` and by a `registerMessages` that changes a template. */
  generation: number
  /** A translator failure was logged (reset by `setTranslator`). */
  failureLogged?: boolean
  /** A scope function failure was logged (reset by `setTranslator`). */
  scopeFailureLogged?: boolean
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
/** Distinct scopes given memo keys per generation: keeps every memo keyed by `key` bounded. */
const MAX_SCOPES = 32
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
  opts?: TTranslatorOptions,
): void {
  const isMap = typeof translate === 'object'
  state.translate = isMap ? mapTranslator(translate) : translate
  state.scoping = opts?.scope && { translate: state.translate, get: opts.scope }
  state.noPathPrefix = opts?.pathPrefix === false ? state.translate : undefined
  const locales = opts?.locales ?? (isMap ? Object.keys(translate) : undefined)
  state.locales = translate && locales?.length ? Object.freeze([...locales]) : NO_LOCALES
  state.failureLogged = false
  state.scopeFailureLogged = false
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

/** Drops everything derived from the translator and the templates. */
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
          (translateCtx ??= translateContext(event, useLocale(event).get(), readScope(event))),
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
  const scope = readScope(event)
  const translateCtx = translateContext(event, locale, scope)
  const generation = state.generation
  const partition = typeof scope === 'string' ? `${locale}:${scope}` : locale
  const key =
    state.locales.includes(locale) && (scope === undefined || (scope !== null && admitted(scope)))
      ? `${generation}:${partition}`
      : undefined
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
  return { locale, partition, key, t, messages }
}

function translateContext(
  event: EventContext,
  locale: string | undefined,
  scope: string | undefined | null,
): TTranslateContext {
  return typeof scope === 'string' ? { locale, scope, event } : { locale, event }
}

/**
 * The event's scope (`opts.scope`): `undefined` without one, `null` when the scope function
 * threw (logged once) — translated unscoped then, and not memoized.
 */
function readScope(event: EventContext): string | undefined | null {
  // (a scope set by this copy for the translator another copy has since replaced: ignored)
  const scoping = state.scoping
  if (!scoping || scoping.translate !== state.translate) {
    return undefined
  }
  try {
    const { get } = scoping
    const scope: unknown = tryGetCurrent() === event ? get() : run(event, get)
    return typeof scope === 'string'
      ? scope
      : typeof scope === 'number' && Number.isFinite(scope)
        ? String(scope)
        : undefined
  } catch (error) {
    logOnce(
      'scopeFailureLogged',
      event,
      'The translation scope threw — translating unscoped, without memoizing (logged once)',
      error,
    )
    return null
  }
}

/** Whether `scope` gets memo keys: one of the first {@link MAX_SCOPES} of the generation. */
function admitted(scope: string): boolean {
  if (state.admittedScopes?.generation !== state.generation) {
    state.admittedScopes = { generation: state.generation, names: new Set() }
  }
  const { names } = state.admittedScopes
  if (names.size < MAX_SCOPES) {
    names.add(scope)
  }
  return names.has(scope)
}

/** Logs a failure of the translator or the scope function once per `setTranslator`. */
function logOnce(
  flag: 'failureLogged' | 'scopeFailureLogged',
  event: EventContext,
  message: string,
  error: unknown,
): void {
  if (!state[flag]) {
    state[flag] = true
    useLogger('i18n', event).error(message, error)
  }
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
 *   else by its message text, its English `message` being the fallback; the translator gets the
 *   entry's `path`, `code` and `custom` ({@link TTranslateContext});
 * - the top `message`: by `code` when the body has one (the translator gets that `code`); else,
 *   when it is the first entry's message (`path: message`), the first entry's translation
 *   (`path: ` dropped with `setTranslator(t, { pathPrefix: false })`); else by its text.
 *
 * `MoostHttp` applies it to every error body when it creates the HTTP app.
 */
export function translateErrorBody<
  T extends { message: string; code?: string; params?: Record<string, unknown>; errors?: unknown },
>(body: T, ctx?: EventContext): T {
  const event = ctx ?? current()
  const translate = state.translate
  const locale = useLocale(event).get()
  if (!translate || locale === undefined) {
    return body
  }
  // (no memo key: an error body is never memoized, so the translator may word it per path)
  const base = translateContext(event, locale, readScope(event))
  const t: TEntryTranslateFn = (id, params, fallback, entry) =>
    callTranslator(translate, id, params, entry ? entryContext(base, entry) : base) ??
    untranslated(id, params, fallback)
  const source: unknown[] | undefined = Array.isArray(body.errors) ? body.errors : undefined
  const errors = source && translateEntries(source, t)
  let message: string
  if (typeof body.code === 'string' && body.code) {
    message =
      callTranslator(translate, body.code, body.params, { ...base, code: body.code }) ??
      untranslated(body.code, body.params, body.message)
  } else if (source && errors && isEntry(source[0]) && body.message === topMessage(source[0])) {
    // (translateEntries keeps an entry an entry)
    const first = errors[0] as TErrorEntry
    message = state.noPathPrefix === translate ? first.message : topMessage(first)
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
    logOnce(
      'failureLogged',
      ctx.event,
      `The translator threw for "${id}" — using the untranslated text (logged once)`,
      error,
    )
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

type TEntryContext = Pick<TErrorEntry, 'path' | 'code' | 'custom'>

/** `t` of {@link translateErrorBody}: also passes the entry's `path`, `code` and `custom` on. */
type TEntryTranslateFn = (
  id: string,
  params: Record<string, unknown> | undefined,
  fallback: string,
  entry?: TEntryContext,
) => string

/** `base` with the entry's `path` and `code` (each only when a string) and `custom: true`. */
function entryContext(
  base: TTranslateContext,
  { path, code, custom }: TEntryContext,
): TTranslateContext {
  const hasCode = typeof code === 'string' && code !== ''
  if (typeof path !== 'string' && !hasCode && custom !== true) {
    return base
  }
  const out: TTranslateContext = { ...base }
  if (typeof path === 'string') {
    out.path = path
  }
  if (hasCode) {
    out.code = code
  }
  if (custom === true) {
    out.custom = true
  }
  return out
}

function translateEntries(entries: unknown[], t: TEntryTranslateFn): unknown[] {
  return entries.map((entry) => {
    if (!isEntry(entry)) {
      return entry
    }
    const id =
      typeof entry.code === 'string' && entry.code && entry.custom !== true
        ? entry.code
        : entry.message
    const out: TErrorEntry = { ...entry, message: t(id, entry.params, entry.message, entry) }
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
