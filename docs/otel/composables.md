# Composables

`@moostjs/otel` provides composables for accessing OpenTelemetry context from within your event handlers. Like all Moost composables, they must be called inside an active event context.

## `useOtelContext()`

The main composable for interacting with OpenTelemetry. Returns an object with tracing utilities scoped to the current event.

```ts
import { useOtelContext } from '@moostjs/otel'

@Get('users/:id')
async getUser(@Param('id') id: string) {
  const {
    trace,                 // OpenTelemetry trace API
    getSpan,               // Get the current event span
    getSpanContext,         // Get span context (traceId, spanId)
    getPropagationHeaders,  // Get trace-context headers for outgoing requests
    registerSpan,          // Set the root span for the current event
    pushSpan,              // Make a span the active span (auto-restores on end)
    customSpanAttr,        // Add attribute to Moost-created spans
    customMetricAttr,      // Add attribute to event metrics
  } = useOtelContext()

  customSpanAttr('user.id', id)
  return fetchUser(id)
}
```

### `customSpanAttr(name, value)`

Adds a custom attribute to the spans created by the `SpanInjector`. The attributes are applied to each Moost-created span that ends **after** the call — the handler span, the after-phase spans, and the root event span when the injector ends it — so call it as early as possible to cover more spans. Spans created by external instrumentation (e.g. an HTTP server span from `@opentelemetry/instrumentation-http`) do not receive these attributes.

```ts
const { customSpanAttr } = useOtelContext()

customSpanAttr('user.id', '123')
customSpanAttr('user.role', 'admin')
customSpanAttr('cache.hit', 1)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `name` | `string` | Attribute key |
| `value` | `string \| number` | Attribute value |

### `customMetricAttr(name, value)`

Adds a custom attribute to the event duration metric. Like span attributes, these are applied when the event completes.

```ts
const { customMetricAttr } = useOtelContext()

customMetricAttr('tenant.id', 'acme')
customMetricAttr('response.cached', 1)
```

### `getSpan()`

Returns the root span for the current event, or `undefined` if no span is active.

```ts
const { getSpan } = useOtelContext()

const span = getSpan()
span?.addEvent('cache-miss', { key: 'user:123' })
```

### `getSpanContext()`

Returns the span context containing `traceId`, `spanId`, and `traceFlags`.

```ts
const { getSpanContext } = useOtelContext()

const ctx = getSpanContext()
console.log(`Trace: ${ctx?.traceId}, Span: ${ctx?.spanId}`)
```

### `getPropagationHeaders()`

Returns trace-context headers (`traceparent`, `tracestate`) for propagating traces to downstream services.

```ts
const { getPropagationHeaders } = useOtelContext()

const headers = getPropagationHeaders()
```

::: warning Not strictly W3C-compliant
The returned values deviate from the W3C trace-context spec: `traceparent` renders the trace flags as a plain decimal number without zero-padding (e.g. `00-…-1` instead of `00-…-01`), and `tracestate` is the OpenTelemetry `TraceState` object, not a serialized header string — spreading it into request headers produces `[object Object]`. Strict parsers may reject these values. For spec-compliant propagation, use the standard OpenTelemetry API instead:

```ts
import { context, propagation } from '@opentelemetry/api'

const headers: Record<string, string> = {}
propagation.inject(context.active(), headers)

const response = await fetch('http://user-service/api/users', {
  headers: {
    ...headers,
    'Content-Type': 'application/json',
  },
})
```
:::

## `useTrace()`

Shorthand to access the OpenTelemetry `trace` API directly. Useful when you need to create custom tracers.

```ts
import { useTrace } from '@moostjs/otel'

const trace = useTrace()
const tracer = trace.getTracer('my-custom-tracer')
const span = tracer.startSpan('custom-operation')
```

## `useSpan()`

Shorthand that returns the root span for the current event. Equivalent to `useOtelContext().getSpan()`.

```ts
import { useSpan } from '@moostjs/otel'

const span = useSpan()
span?.setAttribute('custom.key', 'value')
span?.addEvent('checkpoint', { step: 'validation-complete' })
```

## `useOtelPropagation()`

Returns trace propagation data including the span context fields and trace-context headers.

```ts
import { useOtelPropagation } from '@moostjs/otel'

const { traceId, spanId, traceFlags, traceState, headers } = useOtelPropagation()
```

| Field | Type | Description |
|-------|------|-------------|
| `traceId` | `string?` | 32-character hex trace ID |
| `spanId` | `string?` | 16-character hex span ID |
| `traceFlags` | `number?` | Trace flags (sampled, etc.) |
| `traceState` | `TraceState?` | Vendor-specific trace state |
| `headers` | `object` | `{ traceparent?, tracestate? }` — same values and [compliance caveats](#getpropagationheaders) as `getPropagationHeaders()` |

## `withSpan()`

Utility for executing a callback within a span context — the way to wrap a unit of work in a child span. Unlike the `useOtelContext()` composables, this is a standalone function that doesn't require an active event context, and it accepts either a span name (`{ name, options }`) or an existing span.

```ts
import { withSpan } from '@moostjs/otel'

// Create a span from name + options
const result = withSpan({ name: 'db-query' }, () => {
  return db.query('SELECT * FROM users')
})

// Use an existing span
const tracer = trace.getTracer('default')
const span = tracer.startSpan('my-op')
const result = withSpan(span, () => doWork())
```

### With post-processing

When you pass a `postProcess` callback, **you are responsible for ending the span**:

```ts
withSpan(
  { name: 'db-query' },
  () => db.query('SELECT * FROM users'),
  (span, exception, result) => {
    if (result) {
      span.setAttribute('db.row_count', result.length)
    }
    span.end() // You must end the span yourself
  }
)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `span` | `TSpanInput \| Span` | Span name + options, or an existing span |
| `cb` | `() => T` | Callback to execute (sync or async) |
| `postProcess?` | `TPostSpanProcessFn` — `(span, error?, result?) => void` | Post-processing callback. **You must call `span.end()`** when using this. |

Without `postProcess`, the span is ended automatically after the callback completes (or the returned promise resolves).

## Advanced: context keys

`@moostjs/otel` also exports the event-context keys it stores its state under: `otelSpanKey` (root span), `otelRouteKey` (resolved route path), `otelStartTimeKey` (event start time in epoch ms), `customSpanAttrsKey` and `customMetricAttrsKey` (custom attribute maps). They allow advanced integrations to read or seed these values directly via `current()` from `moost` — for normal use, prefer the composables above.
