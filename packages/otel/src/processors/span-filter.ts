import type { ReadableSpan } from '@opentelemetry/sdk-trace-base'

export function shouldSpanBeIgnored(span: ReadableSpan) {
  return span.attributes['moost.ignore'] === true
}
