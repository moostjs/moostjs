import type { EventContext } from '@wooksjs/event-core'
import { current, useLocale } from '@wooksjs/event-core'

/** What a translator gets besides the text: the event's locale and the event itself. */
export interface TTranslateContext {
  /** `useLocale().get()` of the event the text is translated for. */
  locale: string | undefined
  /** The event context — read anything else your policy needs from it. */
  event: EventContext
}

/**
 * The app's translator. `text` is a source text (gettext-style message id) or an error/message
 * code (`WF_EXPIRED`, `NAME_TAKEN`, …); `params` are the values it refers to. Return the
 * translation, or `undefined` to keep `text` as is.
 *
 * Moost never translates on its own: plug in any i18n library (vue-i18n, i18next, FormatJS)
 * or a plain map here.
 */
export type TTranslate = (
  text: string,
  params: Record<string, unknown> | undefined,
  ctx: TTranslateContext,
) => string | undefined

// Interned via Symbol.for: one translator per process, even with duplicate moost copies
// (dual ESM/CJS, or several installs) — the packages that serialise text share it.
const TRANSLATOR = Symbol.for('moost.translator')
const registry = globalThis as { [TRANSLATOR]?: TTranslate }

/**
 * Registers the app's translator (process-wide), or removes it with `undefined`.
 * It takes effect where code calls {@link useTranslate} — your own code and packages that opt
 * in to translating the text they serialise; with no translator registered, text stays as
 * authored.
 *
 * @example
 * ```ts
 * const messages = { de: { 'Name taken': 'Name vergeben' } }
 * setTranslator((text, params, { locale }) => messages[locale ?? '']?.[text])
 * ```
 */
export function setTranslator(translate: TTranslate | undefined): void {
  registry[TRANSLATOR] = translate
}

/** The registered translator, or `undefined` (e.g. to skip a per-locale variant entirely). */
export function getTranslator(): TTranslate | undefined {
  return registry[TRANSLATOR]
}

/**
 * Returns `t(text, params?)` for the current event: the registered translator's result in the
 * event's locale (`useLocale().get()`), else `text` unchanged — never a missing-key marker.
 * With no translator registered, `t` returns `text` (params are not interpolated).
 *
 * @example
 * ```ts
 * const t = useTranslate()
 * throw new HttpError(409, { message: t('Name taken'), code: 'NAME_TAKEN' })
 * ```
 */
export function useTranslate(
  ctx?: EventContext,
): (text: string, params?: Record<string, unknown>) => string {
  const event = ctx ?? current()
  let translateCtx: TTranslateContext | undefined
  return (text, params) => {
    const translate = getTranslator()
    if (!translate) {
      return text
    }
    translateCtx ??= { locale: useLocale(event).get(), event }
    return translate(text, params, translateCtx) ?? text
  }
}
