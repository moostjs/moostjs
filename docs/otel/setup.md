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
const provider = new NodeTracerProvider({
  spanProcessors: [
    new MoostBatchSpanProcessor(
      new OTLPTraceExporter({
        url: 'http://localhost:4318/v1/traces',
      })
    ),
  ],
})

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

::: tip
Moost reads the active context injector on every event, so an injector installed (or reset) after `app.init()` also applies to handlers that are already bound. Up to 0.6.47 bound handlers kept the injector that was active when they were bound.
:::

### Initialization order

Regardless of how you configure the SDK, the order matters:

1. **Register the tracer provider** (so the global tracer is available)
2. **Register the global meter provider** if you export [metrics](/otel/metrics#metrics-sdk-setup) — a meter created before registration never records anything
3. **Call `enableOtelForMoost()`** (replaces Moost's context injector and creates the meter)
4. **Create and start your Moost app**

```ts
import { Moost } from 'moost'
import { MoostHttp } from '@moostjs/event-http'
import { enableOtelForMoost, MoostBatchSpanProcessor } from '@moostjs/otel'
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'

// 1. Tracer provider + exporter (your setup may differ)
const provider = new NodeTracerProvider({
  spanProcessors: [new MoostBatchSpanProcessor(new OTLPTraceExporter())],
})
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
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node'
import { MoostBatchSpanProcessor } from '@moostjs/otel'

const provider = new NodeTracerProvider({
  spanProcessors: [
    new MoostBatchSpanProcessor(exporter, {
      maxQueueSize: 2048,
      maxExportBatchSize: 512,
      scheduledDelayMillis: 5000,
    }),
  ],
})
```

Use this for production. It batches spans and exports them periodically, reducing overhead.

### `MoostSimpleSpanProcessor`

Extends the standard `SimpleSpanProcessor`. Exports spans immediately (one by one) while still filtering out ignored spans.

```ts
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node'
import { MoostSimpleSpanProcessor } from '@moostjs/otel'

const provider = new NodeTracerProvider({
  spanProcessors: [new MoostSimpleSpanProcessor(exporter)],
})
```

Use this for development or debugging when you want to see spans in real time.

::: warning
`@OtelIgnoreSpan()` only works with `MoostBatchSpanProcessor` or `MoostSimpleSpanProcessor`. If you use the standard OpenTelemetry processors directly, ignored spans will still be exported.
:::

If you build a custom span processor, use the exported `shouldSpanBeIgnored(span)` predicate in its `onEnd()` to apply the same filtering — it returns `true` for spans tagged by `@OtelIgnoreSpan()`.

## Filtering with decorators

### `@OtelIgnoreSpan()`

Prevents spans from being exported for the decorated controller or handler. The lifecycle phase spans (`Interceptors:before`, `Handler:...`, etc.) are not created at all — the callbacks run without span wrapping. The root event span is still created, tagged with `moost.ignore: true`, and dropped by the Moost span processors before export.

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
Controller-level and handler-level decorators are additive: if either the controller or the handler is decorated, the setting applies to that handler. There is no way to opt a single handler back in when its controller is decorated.
:::

For custom tooling that needs to read these flags, `getOtelMate()` returns the shared Moost metadata instance typed with the `TOtelMate` fields (`otelIgnoreSpan`, `otelIgnoreMeter`).

## HTTP instrumentation

For HTTP events, `@moostjs/otel` expects the root span to be created by the OpenTelemetry HTTP instrumentation (`@opentelemetry/instrumentation-http`): the `SpanInjector` attaches to that server span rather than creating a new one — renames it to `{METHOD} {route}` (e.g. `GET /users/:id`), sets `http.route` and the [controller attributes](/otel/spans#controller-attributes) on it, and reports the route to the instrumentation, so its own `http.server.request.duration` metric carries `http.route` too — and patches the response to capture status codes for metrics. The instrumentation ends the span; attributes from `customSpanAttr()` are not applied to it.

```ts
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http'
import { registerInstrumentations } from '@opentelemetry/instrumentation'

registerInstrumentations({
  instrumentations: [new HttpInstrumentation()],
})
```

When there is no instrumentation server span to attach to — HTTP instrumentation is not registered, or the request is served in-process (`request()` / `fetch()` on the HTTP app, an SSR render inside a handler) — the `SpanInjector` creates its own span, named the same way: a `SERVER` root span when no span is active, otherwise an `INTERNAL` child (an in-process request is not a network request, so the trace never gets a second `SERVER` span). An unmatched request (404) is named after the method only (e.g. `GET`), and so is an HTTP context that never routes (`withHttpContext()`, e.g. an SSR render). For non-HTTP event types (CLI, Workflow, custom), the `SpanInjector` always creates the root span itself (named `"{EventType} Event"`).

::: warning Versions up to 0.6.49
The HTTP check never matched in `@moostjs/otel` 0.6.0 – 0.6.49: every HTTP event started its own `http Event` span (renamed `http {route}`, e.g. `http /users/:id`) as a child of the instrumentation's server span, which kept its bare method name, and the `http.status_code` metric attribute was never recorded. An unmatched route also threw from the request listener while tracing was enabled. If your dashboards or alerts match on `http /…` span names, switch them to `{METHOD} {route}`.
:::

::: info
The `moost.event_type` attribute value for HTTP events is the lowercase `http`.
:::

## Middleware mode

When Moost runs as a middleware of a host app — Express, Connect, a custom Node server, or [`@moostjs/vite`](/webapp/vite) with `middleware: true` — it traces only the requests it serves. Mount it with `getServerCb(onNoMatch)` so requests no Moost route matches go on to the host:

```ts
import express from 'express'
import { MoostHttp } from '@moostjs/event-http'

const http = new MoostHttp()
// ... app.adapter(http), registerControllers, init

const nextFor = new WeakMap<object, () => void>()
const moost = http.getServerCb((req) => nextFor.get(req)?.())

const server = express()
server.use('/api', (req, res, next) => {
  nextFor.set(req, next)
  moost(req, res)
})
```

No Moost-specific setup is needed: register the HTTP instrumentation as in [HTTP instrumentation](#http-instrumentation). Instrumentation for the host framework (`@opentelemetry/instrumentation-express`, `-connect`) is optional and works alongside.

| Setup | What you get for a request Moost serves |
|---|---|
| HTTP instrumentation (+ host framework instrumentation) | The instrumentation's server span is renamed `GET /api/users/:id` and gets `http.route` and the controller attributes — even when the host's middleware span is the active one. Moost's lifecycle spans nest under that middleware span. No second `SERVER` span. |
| No HTTP instrumentation | Moost creates its own `SERVER` root span, named the same way. |

- **Requests the host serves** produce no Moost span, no span rename and no `moost.event.duration` metric: a request no Moost route matches never starts a Moost event, so static assets and host routes are left untouched.
- **Mount path.** When the host strips a mount path from `req.url` (`server.use('/api', ...)`), the span name and `http.route` include the mount (`/api/users/:id`) if the host framework's instrumentation reported it; without that instrumentation they carry the route as Moost sees it (`/users/:id`). `moost.route` and the metric's `route` are always the Moost route.
- **Host code calling Moost in-process** (`http.request('/users/1')` from a host route, an SSR render's API fetch) gets an `INTERNAL` child span — it never renames the host's server span.
- **An SSR render** run through `withHttpContext()` for a page the host serves attaches to the request's server span (or starts the `SERVER` root span without instrumentation), so its in-process API fetches nest under it. The render itself never routes, so it records no `moost.event.duration` metric (its API fetches do).

::: warning Versions up to 0.6.50
In middleware mode, every request — including those Moost handed over to the host — started a Moost event: without HTTP instrumentation each one produced a `GET` `SERVER` span and a `moost.event.duration` metric with `http.status_code: 0`; with Express instrumentation each one produced an `INTERNAL` `GET` span. Under Express instrumentation a request Moost served got an `INTERNAL` `GET /users/:id` span while the server span kept the host's name (`GET`, or the mount path such as `GET /api`). With HTTP instrumentation only, host code calling Moost in-process (e.g. an SSR render's API fetch without context forwarding) attached to the host's server span and renamed it after the API route. `http.route` was never set by Moost, and an HTTP context that never routed was named `http Event`.
:::

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
