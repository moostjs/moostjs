import type { Span } from '@opentelemetry/api'
import { context, SpanStatusCode, trace } from '@opentelemetry/api'
import type { IncomingMessage } from 'http'
import {
  eventContextHooks,
  getConstructor,
  useAsyncEventContext,
  useControllerContext,
} from 'moost'

import { useOtelContext } from './context'

export function enableOtelForMoost() {
  eventContextHooks.onStartEvent((eventType: string) => {
    const { registerSpan } = useOtelContext()

    let span: Span | undefined
    if (eventType === 'HTTP') {
      // assume that httpInstrumentation and span is already created
      span = trace.getSpan(context.active())
    } else {
      // we must create a new span for other types of events
      const tracer = trace.getTracer('moost-tracer')
      span = tracer.startSpan(`${eventType} Event`)
    }
    if (span) {
      registerSpan(span)
    }
  })
  eventContextHooks.onEndEvent((eventType: string, abortReason?: string) => {
    const { getSpan } = useOtelContext()
    const span = getSpan()
    if (span) {
      const { getMethod, getMethodMeta, getController } = useControllerContext()
      const methodName = getMethod()
      const methodMeta = getMethodMeta()
      span.setAttributes({
        'custom.event_type': eventType,
        'custom.event_description': methodMeta?.description || methodMeta?.label || methodName,
        'moost.controller': getConstructor(getController()).name,
        'moost.handler': methodName,
      })
      if (abortReason) {
        span.recordException(new Error(abortReason))
        span.setStatus({ code: SpanStatusCode.ERROR, message: abortReason })
      }
      if (eventType === 'HTTP') {
        // assume that httpInstrumentation and span will be closed automatically
        const req = useAsyncEventContext<{ event: { req: IncomingMessage } }>()
          .store('event')
          .get('req')
        span.updateName(`${req?.method || ''} ${methodMeta?.id || methodMeta?.label || methodName}`)
      } else {
        // we must end span for other types of events
        span.updateName(`${methodMeta?.label || methodName}`)
        span.end()
      }
    }
  })
}
