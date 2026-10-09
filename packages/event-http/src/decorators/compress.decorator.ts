import type { THttpCompressionOptions } from '@wooksjs/event-http'
import { useResponse } from '@wooksjs/event-http'
import { defineBeforeInterceptor, Intercept, TInterceptorPriority } from 'moost'

/**
 * Overrides response compression for a handler or a whole controller.
 *
 * Calls `useResponse().setCompression(value)` before guards, argument resolution and the
 * handler run, so the override also applies to error responses (401, 400, …).
 * A method-level `@Compress` wins over a class-level one.
 *
 * - `true` (default) — compress with the app settings (`new MoostHttp({ compression })`),
 *   or the defaults when the app has compression off.
 * - `false` — never compress this response (e.g. a body that mixes a secret with
 *   reflected input — see BREACH).
 * - options object — compress with these settings layered over the app settings.
 *
 * ```ts
 * import { Compress, Get } from '@moostjs/event-http'
 * import { Controller } from 'moost'
 *
 * @Controller()
 * export class ReportsController {
 *   @Get('report')
 *   @Compress({ brotliQuality: 6 })
 *   report() {
 *     return buildReport()
 *   }
 *
 *   @Get('session')
 *   @Compress(false)
 *   session() {
 *     return { token, echo: query }
 *   }
 * }
 * ```
 *
 * @param value compression override, defaults to `true`
 */
export const Compress = (value: boolean | THttpCompressionOptions = true) =>
  Intercept(
    defineBeforeInterceptor(() => {
      useResponse().setCompression(value)
    }, TInterceptorPriority.BEFORE_ALL),
  )
