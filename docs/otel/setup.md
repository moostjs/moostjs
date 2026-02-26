# Setup & Configuration

This page covers enabling Moost's OpenTelemetry integration, Moost-specific span processors, and filtering decorators. It also shows example SDK configurations, though **your actual OpenTelemetry SDK setup will depend on your project's infrastructure, tracing backend, and deployment environment**.

::: tip
`@moostjs/otel` adds Moost-specific instrumentation on top of the standard OpenTelemetry SDK. The SDK setup itself (providers, exporters, resource attributes, sampling) is not Moost-specific — refer to the [OpenTelemetry JS documentation](https://opentelemetry.io/docs/languages/js/) for comprehensive guidance on configuring the SDK for your needs.
:::

## OpenTelemetry SDK setup

Before enabling Moost instrumentation, configure the OpenTelemetry SDK. A typical setup involves three pieces: a **tracer provider**, a **span processor**, and an **exporter**. The exact configuration varies by project — the example below uses OTLP over HTTP, but you might use Jaeger, Zipkin, a console exporter, or any other backend.

```ts
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { MoostBatchSpanProcessor } from '@moostjs/otel'

// Example configuration — adjust for your tracing backend
const provider = new NodeTracerProvider()

provider.addSpanProcessor(
  new MoostBatchSpanProcessor(
    new OTLPTraceExporter({
      url: 'http://localhost:4318/v1/traces',
    })
  )
)

provider.register()
```

::: tip
Call `provider.register()` **before** `enableOtelForMoost()` so the global tracer is available when Moost starts creating spans.
:::

## Enabling Moost instrumentation

```ts
import { enableOtelForMoost } from '@moostjs/otel'

enableOtelForMoost()
```

This replaces Moost's default context injector with the `SpanInjector`. Call it once, **after** registering the tracer provider and **before** creating your Moost application instance.

### Initialization order

Regardless of how you configure the SDK, the order matters:

1. **Register the tracer provider** (so the global tracer is available)
2. **Call `enableOtelForMoost()`** (replaces Moost's context injector)
3. **Create and start your Moost app**

```ts
import { Moost } from 'moost'
import { MoostHttp } from '@moostjs/event-http'
import { enableOtelForMoost, MoostBatchSpanProcessor } from '@moostjs/otel'
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'

// 1. Tracer provider + exporter (your setup may differ)
const provider = new NodeTracerProvider()
provider.addSpanProcessor(
  new MoostBatchSpanProcessor(new OTLPTraceExporter())
)
provider.register()

// 2. Enable Moost instrumentation
enableOtelForMoost()

// 3. Create and start the app
const app = new Moost()
app.adapter(new MoostHttp()).listen(3000)
await app.init()
```

## Span processors

OpenTelemetry span processors control how spans are batched and exported. Moost provides drop-in replacements that add **span filtering** support via the `@OtelIgnoreSpan()` decorator.

### `MoostBatchSpanProcessor`

Extends the standard `BatchSpanProcessor`. Spans marked with `@OtelIgnoreSpan()` are silently dropped before batching — they never reach the exporter.

```ts
import { MoostBatchSpanProcessor } from '@moostjs/otel'

provider.addSpanProcessor(
  new MoostBatchSpanProcessor(exporter, {
    maxQueueSize: 2048,
    maxExportBatchSize: 512,
    scheduledDelayMillis: 5000,
  })
)
```

Use this for production. It batches spans and exports them periodically, reducing overhead.

### `MoostSimpleSpanProcessor`

Extends the standard `SimpleSpanProcessor`. Exports spans immediately (one by one) while still filtering out ignored spans.

```ts
import { MoostSimpleSpanProcessor } from '@moostjs/otel'

provider.addSpanProcessor(
  new MoostSimpleSpanProcessor(exporter)
)
```

Use this for development or debugging when you want to see spans in real time.

::: warning
`@OtelIgnoreSpan()` only works with `MoostBatchSpanProcessor` or `MoostSimpleSpanProcessor`. If you use the standard OpenTelemetry processors directly, ignored spans will still be exported.
:::

## Filtering with decorators

### `@OtelIgnoreSpan()`

Prevents spans from being exported for the decorated controller or handler. The spans are still created internally (so child spans can reference a parent), but they are dropped by the Moost span processors before export.

```ts
import { Controller } from 'moost'
import { Get } from '@moostjs/event-http'
import { OtelIgnoreSpan } from '@moostjs/otel'

@Controller('health')
@OtelIgnoreSpan()
class HealthController {
  @Get()
  check() {
    return { status: 'ok' }
  }
}
```

Apply at handler level to ignore a single endpoint:

```ts
@Controller('api')
class ApiController {
  @Get('status')
  @OtelIgnoreSpan()
  status() {
    return { ok: true }
  }

  @Get('users')
  users() {
    // This handler's spans ARE exported
    return []
  }
}
```

### `@OtelIgnoreMeter()`

Suppresses **metrics collection** for the decorated controller or handler. Spans are still created and exported normally.

```ts
import { OtelIgnoreMeter } from '@moostjs/otel'

@Controller('internal')
@OtelIgnoreMeter()
class InternalController {
  @Get('debug')
  debug() {
    return { info: 'debug data' }
  }
}
```

::: tip
Handler-level decorators override controller-level decorators. If a controller has `@OtelIgnoreSpan()` but a specific handler does not, that handler's spans will still be filtered because it inherits the controller's setting.
:::

## HTTP instrumentation

For HTTP events, `@moostjs/otel` expects the root span to be created by the OpenTelemetry HTTP instrumentation (`@opentelemetry/instrumentation-http`). The `SpanInjector` attaches to the existing HTTP span rather than creating a new one, and patches the response to capture status codes for metrics.

```ts
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http'
import { registerInstrumentations } from '@opentelemetry/instrumentation'

registerInstrumentations({
  instrumentations: [new HttpInstrumentation()],
})
```

For non-HTTP event types (CLI, Workflow, custom), the `SpanInjector` creates the root span itself (named `"{EventType} Event"`).

## Exporter examples

These are common exporter configurations for reference. Your project may use a different exporter or configuration entirely — see the [OpenTelemetry registry](https://opentelemetry.io/ecosystem/registry/?language=js&component=exporter) for the full list of available exporters.

### Jaeger (via OTLP)

```ts
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'

const exporter = new OTLPTraceExporter({
  url: 'http://localhost:4318/v1/traces',
})
```

### Zipkin

```ts
import { ZipkinExporter } from '@opentelemetry/exporter-zipkin'

const exporter = new ZipkinExporter({
  url: 'http://localhost:9411/api/v2/spans',
})
```

### Console (development)

```ts
import { ConsoleSpanExporter } from '@opentelemetry/sdk-trace-base'

const exporter = new ConsoleSpanExporter()
```
