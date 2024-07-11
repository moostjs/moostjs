import type { ReadableSpan } from '@opentelemetry/sdk-trace-base'
import { SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base'

import { shouldSpanBeIgnored } from './span-filter'

export class MoostSimpleSpanProcessor extends SimpleSpanProcessor {
  onEnd(span: ReadableSpan): void {
    if (shouldSpanBeIgnored(span)) {
      return
    }
    super.onEnd(span)
  }
}
