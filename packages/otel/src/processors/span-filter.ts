import type { ReadableSpan } from '@opentelemetry/sdk-trace-base'

/** Returns `true` if the span has the `moost.ignore` attribute set by `@OtelIgnoreSpan()`. */
export function shouldSpanBeIgnored(span: ReadableSpan) {
  return span.attributes['moost.ignore'] === true
}
