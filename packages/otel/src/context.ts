import type { Span, SpanOptions } from '@opentelemetry/api'
import { context, trace } from '@opentelemetry/api'
import { useAsyncEventContext } from 'moost'

export interface TOtelContext {
  otel?: {
    span?: Span
  }
}

export function useOtelContext() {
  const store = useAsyncEventContext<TOtelContext>().store('otel')

  const getSpan = () => store.get('span')

  const getSpanContext = () => {
    const span = getSpan()
    if (span) {
      return span.spanContext()
    }
  }

  const getPropagationHeaders = () => {
    const c = getSpanContext()
    if (c) {
      return {
        traceparent: `00-${c.traceId}-${c.spanId}-${c.traceFlags}`,
        tracestate: c.traceState,
      }
    }
    return {}
  }

  return {
    trace,
    withChildSpan: <T>(name: string, cb: (...a: any[]) => T, opts?: SpanOptions) => {
      const parentSpan = getSpan()
      if (parentSpan) {
        const tracer = trace.getTracer('moost-tracer')
        const span = tracer.startSpan(name, opts)
        return () => context.with(trace.setSpan(context.active(), span), () => cb())
      } else {
        return cb()
      }
    },
    getSpan,
    getSpanContext,
    getPropagationHeaders,
    registerSpan: (span: Span) => store.set('span', span),
  }
}

export function useTrace() {
  return trace
}

export function useSpan() {
  return useOtelContext().getSpan()
}

export function useOtelPropagation() {
  const { getPropagationHeaders, getSpanContext } = useOtelContext()
  return {
    ...getSpanContext(),
    headers: getPropagationHeaders(),
  }
}
