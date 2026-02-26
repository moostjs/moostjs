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
    getPropagationHeaders,  // Get W3C headers for outgoing requests
    withChildSpan,         // Create a child span
    customSpanAttr,        // Add attribute to the event span
    customMetricAttr,      // Add attribute to event metrics
  } = useOtelContext()

  customSpanAttr('user.id', id)
  return fetchUser(id)
}
```

### `customSpanAttr(name, value)`

Adds a custom attribute to the root event span. Attributes are applied when the span ends, so you can call this at any point during the handler lifecycle.

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

Returns W3C trace-context headers (`traceparent`, `tracestate`) for propagating traces to downstream services.

```ts
const { getPropagationHeaders } = useOtelContext()

const headers = getPropagationHeaders()
const response = await fetch('http://user-service/api/users', {
  headers: {
    ...headers,
    'Content-Type': 'application/json',
  },
})
```

### `withChildSpan(name, callback, options?)`

Creates a child span and returns a function that executes the callback within that span's context. This two-step API lets you prepare the span and invoke it separately.

```ts
const { withChildSpan } = useOtelContext()

// Create and immediately invoke
const result = await withChildSpan('fetch-user-data', async () => {
  return await db.users.findById(id)
})()

// Or prepare and invoke later
const fetchData = withChildSpan('fetch-user-data', async () => {
  return await db.users.findById(id)
})
const data = await fetchData()
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `name` | `string` | Span name |
| `callback` | `(...args) => T` | Function to execute within the span |
| `options?` | `SpanOptions` | OpenTelemetry span options (kind, attributes, links, etc.) |

::: tip
`withChildSpan` creates the span immediately but only activates its context when you call the returned function. The span remains open until the callback completes.
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

Returns trace propagation data including the span context fields and ready-to-use HTTP headers.

```ts
import { useOtelPropagation } from '@moostjs/otel'

const { traceId, spanId, traceFlags, traceState, headers } = useOtelPropagation()

// Pass headers to downstream HTTP calls
const response = await fetch('http://downstream-service/api', {
  headers: {
    ...headers,
    'Content-Type': 'application/json',
  },
})
```

| Field | Type | Description |
|-------|------|-------------|
| `traceId` | `string?` | 32-character hex trace ID |
| `spanId` | `string?` | 16-character hex span ID |
| `traceFlags` | `number?` | Trace flags (sampled, etc.) |
| `traceState` | `TraceState?` | Vendor-specific trace state |
| `headers` | `object` | `{ traceparent?, tracestate? }` — W3C headers |

## `withSpan()`

Low-level utility for executing a callback within a span context. Unlike `withChildSpan` from `useOtelContext()`, this is a standalone function that doesn't require an active event context.

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
| `postProcess?` | `(span, error?, result?) => void` | Post-processing callback. **You must call `span.end()`** when using this. |

Without `postProcess`, the span is ended automatically after the callback completes (or the returned promise resolves).
