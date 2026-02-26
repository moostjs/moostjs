# @moostjs/otel

`@moostjs/otel` integrates [OpenTelemetry](https://opentelemetry.io/) with Moost, providing **automatic distributed tracing** and **metrics collection** for every event your application handles. It hooks into Moost's context injector system to wrap each lifecycle phase — interceptors, argument resolution, handler execution — in spans, without any manual instrumentation in your handler code.

## What you get

- **Automatic spans** for every event lifecycle phase (interceptors, arg resolution, handler call)
- **Event duration metrics** with route, event type, and error status attributes
- **Trace propagation** helpers for passing context to downstream services
- **Custom span & metric attributes** from within your handlers
- **Selective filtering** — suppress spans or metrics for health checks, internal endpoints, etc.
- **Drop-in span processors** that respect filtering decorators

## Installation

```bash
npm install @moostjs/otel @opentelemetry/api @opentelemetry/sdk-trace-base
```

You will also need an exporter for your tracing backend (Jaeger, Zipkin, OTLP, etc.):

```bash
# Example: OTLP exporter (works with Jaeger, Grafana Tempo, etc.)
npm install @opentelemetry/exporter-trace-otlp-http
```

## Quick start

The only Moost-specific step is calling `enableOtelForMoost()` before creating your app. Everything else — tracer providers, exporters, span processors — is standard OpenTelemetry SDK configuration that varies by project and infrastructure.

::: tip
The OpenTelemetry SDK setup below is just one possible configuration. Your project may use different providers, exporters, or initialization patterns depending on your tracing backend and deployment environment. Refer to the [OpenTelemetry JS documentation](https://opentelemetry.io/docs/languages/js/) for the full range of options.
:::

```ts
import { Moost } from 'moost'
import { MoostHttp } from '@moostjs/event-http'
import { enableOtelForMoost, MoostBatchSpanProcessor } from '@moostjs/otel'
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'

// 1. Configure OpenTelemetry SDK (your setup may differ)
const provider = new NodeTracerProvider()
provider.addSpanProcessor(
  new MoostBatchSpanProcessor(new OTLPTraceExporter())
)
provider.register()

// 2. Enable Moost instrumentation (before creating the app)
enableOtelForMoost()

// 3. Create and start your app as usual
const app = new Moost()
app.adapter(new MoostHttp()).listen(3000)
await app.init()
```

Every incoming event now produces spans and metrics automatically — no decorator annotations needed on your handlers.

## How it works

```
Incoming event
  └─ Event:start span (wraps entire lifecycle)
       ├─ Interceptors:before
       │    └─ Interceptor:MyGuard  (per-interceptor span)
       │         └─ Arguments:resolve  (if interceptor has params)
       ├─ Arguments:resolve  (handler params)
       ├─ Handler:/users/:id  (handler execution)
       └─ Interceptors:after
            └─ Interceptor:MyGuard  (per-interceptor span)
```

Moost's **context injector** system powers this. When you call `enableOtelForMoost()`, it replaces the default no-op injector with a `SpanInjector` that wraps every lifecycle phase in an OpenTelemetry span. The injector also:

- Sets span attributes with controller name, handler method, route, and event type
- Records exceptions and sets error status on spans
- Collects event duration metrics via an OpenTelemetry histogram
- Applies custom attributes you add from handler code

## What to read next

| Page | What you'll learn |
|------|-------------------|
| [Setup & Configuration](/otel/setup) | Full SDK setup, exporters, span processors, and `@OtelIgnoreSpan` / `@OtelIgnoreMeter` decorators |
| [Automatic Spans](/otel/spans) | Every span Moost creates, their names, attributes, and how they map to the event lifecycle |
| [Composables](/otel/composables) | `useOtelContext()`, `useSpan()`, `useOtelPropagation()`, child spans, and custom attributes |
| [Metrics](/otel/metrics) | Auto-collected duration histogram, recorded attributes, and custom metric attributes |
