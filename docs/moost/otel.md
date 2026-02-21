# OpenTelemetry in Moost

`@moostjs/otel` integrates [OpenTelemetry](https://opentelemetry.io/) with Moost, providing automatic tracing for event handlers, custom span creation, and metrics collection. It leverages Moost's context injector system to wrap every event lifecycle phase in spans without manual instrumentation.

## Installation

```bash
npm install @moostjs/otel @opentelemetry/api @opentelemetry/sdk-trace-base
```

## Setup

Enable OpenTelemetry by calling `enableOtelForMoost()` **before** starting your Moost application:

```ts
import { enableOtelForMoost } from '@moostjs/otel'

// Call before creating/starting your Moost app
enableOtelForMoost()
```

This replaces Moost's default context injector with a `SpanInjector` that automatically creates and manages spans throughout the event lifecycle.

## Composables

### `useOtelContext()`

Access the OpenTelemetry context within an event handler. Returns tracing utilities tied to the current event scope.

```ts
import { useOtelContext } from '@moostjs/otel'

function myHandler() {
  const {
    trace,                // OpenTelemetry trace API
    getSpan,              // Get the current event span
    getSpanContext,       // Get span context (traceId, spanId, etc.)
    getPropagationHeaders,// Get W3C trace-context headers for outgoing requests
    withChildSpan,        // Create a child span with a callback
    customSpanAttr,       // Add custom attribute to the current span
    customMetricAttr,     // Add custom attribute to event metrics
  } = useOtelContext()
}
```

### `useTrace()`

Shorthand to get the OpenTelemetry `trace` API.

```ts
import { useTrace } from '@moostjs/otel'

const trace = useTrace()
const tracer = trace.getTracer('my-tracer')
```

### `useSpan()`

Get the current event's root span.

```ts
import { useSpan } from '@moostjs/otel'

const span = useSpan()
span?.setAttribute('custom.key', 'value')
```

### `useOtelPropagation()`

Get trace propagation data for passing context to downstream services.

```ts
import { useOtelPropagation } from '@moostjs/otel'

const { traceId, spanId, headers } = useOtelPropagation()
// Use `headers` (traceparent, tracestate) in outgoing HTTP requests
```

## Decorators

### `@OtelIgnoreSpan()`

Prevents spans from being exported for the decorated controller or handler. Useful for health-check endpoints or other high-frequency routes that would create noise.

```ts
import { OtelIgnoreSpan } from '@moostjs/otel'
import { Controller, Get } from '@moostjs/event-http'

@Controller('health')
@OtelIgnoreSpan()
class HealthController {
  @Get()
  check() {
    return { status: 'ok' }
  }
}
```

Requires `MoostBatchSpanProcessor` or `MoostSimpleSpanProcessor` (see below).

### `@OtelIgnoreMeter()`

Suppresses metrics collection for the decorated controller or handler.

```ts
import { OtelIgnoreMeter } from '@moostjs/otel'

@OtelIgnoreMeter()
class InternalController { /* ... */ }
```

## Span Processors

Moost provides drop-in replacements for the standard OpenTelemetry span processors that respect the `@OtelIgnoreSpan()` decorator:

- **`MoostBatchSpanProcessor`** — Extends `BatchSpanProcessor`, filters out ignored spans before batching.
- **`MoostSimpleSpanProcessor`** — Extends `SimpleSpanProcessor`, filters out ignored spans immediately.

```ts
import { MoostBatchSpanProcessor } from '@moostjs/otel'
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'

const provider = new NodeTracerProvider()
provider.addSpanProcessor(
  new MoostBatchSpanProcessor(new OTLPTraceExporter())
)
provider.register()
```

## Utility

### `withSpan()`

Low-level helper that executes a callback within a span context. Handles both sync and async callbacks, records exceptions, and manages span lifecycle.

```ts
import { withSpan } from '@moostjs/otel'

const result = withSpan({ name: 'my-operation' }, () => {
  return doSomething()
})
```
