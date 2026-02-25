import type { Span, SpanOptions, TimeInput } from '@opentelemetry/api'
import { context, trace } from '@opentelemetry/api'
import type { EventContext } from '@wooksjs/event-core'
import { current, key } from 'moost'

export const otelSpanKey = key<Span | undefined>('otel.span')
export const otelRouteKey = key<string | undefined>('otel.route')
export const otelStartTimeKey = key<number | undefined>('otel.startTime')
export const customSpanAttrsKey = key<Record<string, string | number>>('customSpanAttrs')
export const customMetricAttrsKey = key<Record<string, string | number>>('customMetricAttrs')

const spanStack = [] as Span[]

/**
 * Provides OpenTelemetry tracing utilities scoped to the current event.
 * Must be called within an active event handler context.
 *
 * @returns Tracing utilities including span access, propagation headers, and custom attributes.
 */
export function useOtelContext(ctx?: EventContext) {
  const _ctx = ctx || current()

  const customSpanAttr = (name: string, value: string | number) => {
    const attrs = _ctx.has(customSpanAttrsKey) ? _ctx.get(customSpanAttrsKey) : {}
    attrs[name] = value
    _ctx.set(customSpanAttrsKey, attrs)
  }
  const customMetricAttr = (name: string, value: string | number) => {
    const attrs = _ctx.has(customMetricAttrsKey) ? _ctx.get(customMetricAttrsKey) : {}
    attrs[name] = value
    _ctx.set(customMetricAttrsKey, attrs)
  }

  const getSpan = () => (_ctx.has(otelSpanKey) ? _ctx.get(otelSpanKey) : undefined)

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
    registerSpan: (span: Span) => _ctx.set(otelSpanKey, span),
    pushSpan,
    customSpanAttr,
    customMetricAttr,
  }
}

/** Returns the OpenTelemetry `trace` API for creating tracers and spans. */
export function useTrace() {
  return trace
}

/** Returns the root span for the current event, or `undefined` if no span is active. */
export function useSpan() {
  return useOtelContext().getSpan()
}

/**
 * Returns W3C trace-context propagation data for the current event.
 * Use the returned `headers` (traceparent, tracestate) in outgoing HTTP requests
 * to propagate the trace to downstream services.
 */
export function useOtelPropagation() {
  const { getPropagationHeaders, getSpanContext } = useOtelContext()
  return {
    ...getSpanContext(),
    headers: getPropagationHeaders(),
  }
}
