import type { Span, SpanOptions } from '@opentelemetry/api'
import { context, SpanStatusCode, trace } from '@opentelemetry/api'

export type TPostSpanProcessFn<T> = (
  span: Span,
  exception: Error | undefined,
  result: Awaited<T> | undefined
) => void

export interface TSpanInput {
  name: string
  options?: SpanOptions
}

/**
 * Starts or continues a span, executes the callback within the span's context,
 * and handles span completion and error recording. Supports both synchronous and asynchronous callbacks.
 * An optional post-processing callback can be used to enrich the span before it ends.
 *
 * @template T
 * @param {TSpanInput | Span} span - The span input containing name and options, or an existing span.
 * @param {() => T} cb - The callback function to execute within the span's context.
 * @param {TPostSpanProcessFn<T>=} postProcess - An optional post-processing callback to enrich the span before it ends. **CAUTION: When used, you must end the span yourself `span.end()`.**
 * @returns {T} The result of the callback function.
 * @throws {Error} Will throw an error if the callback function throws.
 */
export function withSpan<T>(
  span: TSpanInput | Span,
  cb: () => T,
  postProcess?: TPostSpanProcessFn<T>
): T {
  const _span =
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    typeof (span as TSpanInput).name === 'string' && !(span as Span).spanContext
      ? trace
          .getTracer('default')
          .startSpan((span as TSpanInput).name, (span as TSpanInput).options)
      : (span as Span)
  let result = undefined as T

  const finalizeSpan = (e: Error | undefined, r: Awaited<T>) => {
    if (e) {
      _span.recordException(e)
      _span.setStatus({
        code: SpanStatusCode.ERROR,
        message: e.message || 'Unknown Error',
      })
    }
    if (postProcess) {
      postProcess(_span, e, r)
    } else {
      _span.end()
    }
  }

  context.with(trace.setSpan(context.active(), _span), () => {
    try {
      result = cb()
    } catch (error) {
      finalizeSpan(error as Error, undefined as Awaited<T>)
      throw error
    }
    if (result instanceof Promise) {
      result
        .then(r => {
          finalizeSpan(undefined, r as Awaited<T>)
          return r as Awaited<T>
        })
        .catch(error => {
          finalizeSpan(error as Error, undefined as Awaited<T>)
        })
    } else {
      finalizeSpan(undefined, result as Awaited<T>)
    }
  })

  return result
}
