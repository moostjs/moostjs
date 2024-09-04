import type { Span, SpanOptions, TimeInput } from '@opentelemetry/api'
import { context, trace } from '@opentelemetry/api'
import { useAsyncEventContext } from 'moost'

export interface TOtelContext {
  otel?: {
    span?: Span
    route?: string
    startTime?: number
  }
  customSpanAttrs?: Record<string, string>
  customMetricAttrs?: Record<string, string>
}

const spanStack = [] as Span[]

export function useOtelContext() {
  const eventContext = useAsyncEventContext<TOtelContext>()
  const store = eventContext.store('otel')

  const csa = eventContext.store('customSpanAttrs')
  const cma = eventContext.store('customMetricAttrs')

  const customSpanAttr = (name: string, value: string | number) => csa.set(name, value)
  const customMetricAttr = (name: string, value: string | number) => cma.set(name, value)

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

  const pushSpan = (span: Span) => {
    const activeSpan = trace.getActiveSpan()
    if (activeSpan) {
      const origEnd = activeSpan.end
      Object.assign(activeSpan, {
        end: (t?: TimeInput) => {
          popSpan()
          const i = spanStack.indexOf(activeSpan)
          if (i >= 0) {
            spanStack.splice(i, 1)
          }
          origEnd.apply(span, [t])
        },
      })
      spanStack.push(activeSpan)
    }
    trace.setSpan(context.active(), span)
  }
  const popSpan = () => {
    const span = spanStack.pop()
    if (span) {
      trace.setSpan(context.active(), span)
    }
  }

  return {
    trace,
    withChildSpan: <T>(name: string, cb: (...a: any[]) => T, opts?: SpanOptions) => {
      const tracer = trace.getTracer('moost-tracer')
      const span = tracer.startSpan(name, opts)
      return () => context.with(trace.setSpan(context.active(), span), cb)
    },
    getSpan,
    getSpanContext,
    getPropagationHeaders,
    registerSpan: (span: Span) => store.set('span', span),
    pushSpan,
    customSpanAttr,
    customMetricAttr,
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
