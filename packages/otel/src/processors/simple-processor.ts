import type { ReadableSpan } from '@opentelemetry/sdk-trace-base'
import { SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base'

import { shouldSpanBeIgnored } from './span-filter'

/**
 * Simple span processor that filters out spans marked with `@OtelIgnoreSpan()`.
 * Drop-in replacement for `SimpleSpanProcessor` from `@opentelemetry/sdk-trace-base`.
 */
export class MoostSimpleSpanProcessor extends SimpleSpanProcessor {
  onEnd(span: ReadableSpan): void {
    if (shouldSpanBeIgnored(span)) {
      return
    }
    super.onEnd(span)
  }
}
