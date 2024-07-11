import type { ReadableSpan } from '@opentelemetry/sdk-trace-base'
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base'

import { shouldSpanBeIgnored } from './span-filter'

export class MoostBatchSpanProcessor extends BatchSpanProcessor {
  onEnd(span: ReadableSpan): void {
    if (shouldSpanBeIgnored(span)) {
      return
    }
    super.onEnd(span)
  }
}
