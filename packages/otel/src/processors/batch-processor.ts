import type { ReadableSpan } from '@opentelemetry/sdk-trace-base'
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base'

import { shouldSpanBeIgnored } from './span-filter'

/**
 * Batch span processor that filters out spans marked with `@OtelIgnoreSpan()`.
 * Drop-in replacement for `BatchSpanProcessor` from `@opentelemetry/sdk-trace-base`.
 */
export class MoostBatchSpanProcessor extends BatchSpanProcessor {
  onEnd(span: ReadableSpan): void {
    if (shouldSpanBeIgnored(span)) {
      return
    }
    super.onEnd(span)
  }
}
