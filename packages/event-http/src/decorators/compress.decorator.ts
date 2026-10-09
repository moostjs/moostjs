import { key } from '@wooksjs/event-core'
import type { HttpResponse, THttpCompressionOptions } from '@wooksjs/event-http'
import { useResponse } from '@wooksjs/event-http'
import { defineBeforeInterceptor, Intercept, TInterceptorPriority } from 'moost'

import { forHttpEvents } from './http-only'

/** Compression settings of the response before the first `@Compress` of the event ran. */
const compressionBase = key<HttpResponse['compression']>('moost.http.compressionBase')

/**
 * Overrides response compression for a handler or a whole controller.
 *
 * Calls `useResponse().setCompression(value)` before guards, argument resolution and the
 * handler run, so the override also applies to error responses (401, 400, …).
 * A method-level `@Compress` replaces a class-level one: it starts from the app settings
 * rather than layering over the class value. Non-HTTP events of a controller are left alone.
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
    defineBeforeInterceptor(
      forHttpEvents((ctx) => {
        const response = useResponse(ctx)
        // class-level then method-level run in that order: reset to the base so the most
        // specific @Compress wins outright (own slot — an invoke() child has its own response)
        if (ctx.hasOwn(compressionBase)) {
          response.setCompression(ctx.getOwn(compressionBase))
        } else {
          ctx.setOwn(compressionBase, response.compression)
        }
        response.setCompression(value)
      }),
      TInterceptorPriority.BEFORE_ALL,
    ),
  )
