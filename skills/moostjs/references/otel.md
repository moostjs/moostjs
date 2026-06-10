# OpenTelemetry — @moostjs/otel

Automatic tracing + event-duration metrics for Moost via the context-injector system. Install `@moostjs/otel @opentelemetry/api @opentelemetry/sdk-trace-base` plus your exporter packages. `moost` AND `@moostjs/event-http` are required peer deps — event-http even for CLI/WF-only apps (top-level import).

- [Setup](#setup)
- [Automatic spans & metrics](#automatic-spans--metrics)
- [Filtering](#filtering)
- [Composables](#composables)
- [withSpan](#withspan)
- [Gotchas](#gotchas)

## Setup

```ts
import { Moost } from 'moost'
import { MoostHttp } from '@moostjs/event-http'
import { enableOtelForMoost, MoostBatchSpanProcessor } from '@moostjs/otel'
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'

// 1. tracer provider (use MoostBatchSpanProcessor for prod, MoostSimpleSpanProcessor for dev)
const provider = new NodeTracerProvider({
  spanProcessors: [new MoostBatchSpanProcessor(new OTLPTraceExporter())],
})
provider.register()

// 2. (metrics only) metrics.setGlobalMeterProvider(meterProvider) — MUST come before step 3

// 3. replace Moost's context injector with SpanInjector
enableOtelForMoost()

// 4. create + start the app
const app = new Moost()
app.adapter(new MoostHttp()).listen(3000)
await app.init()
```

Order 1→4 is mandatory (see gotcha 1).

## Automatic spans & metrics

Every routed event produces a root event span renamed to `{EventType} {route}` once the controller is resolved, with child spans per lifecycle phase: `Interceptors:before` → `Interceptor:{ClassName}` → `Arguments:resolve` → `Handler:{path}` → `Interceptors:after`. Exceptions are recorded with `ERROR` status. Root-span attributes: `moost.controller`, `moost.handler`, `moost.route`, `moost.event_type`, `moost.handler_description`/`_label`/`_id` (from `@Description`/`@Label`/`@Id`), `moost.ignore`.

Metrics: one histogram `moost.event.duration` (meter `moost-meter`, unit ms) recorded per completed event with `route`, `moost.event_type`, `moost.is_error` (0/1) attributes.

## Filtering

```ts
import { OtelIgnoreSpan, OtelIgnoreMeter } from '@moostjs/otel'
```

- `@OtelIgnoreSpan()` (class or method) — lifecycle spans are not created; the root event span IS created, tagged `moost.ignore: true`, and dropped by `MoostBatchSpanProcessor`/`MoostSimpleSpanProcessor` before export. Standard OTel processors do NOT filter (gotcha 4). Custom processor: call `shouldSpanBeIgnored(span)` in `onEnd()`.
- `@OtelIgnoreMeter()` (class or method) — suppresses the duration metric; spans unaffected.
- To read these flags in custom tooling: `getOtelMate()` returns the shared Mate instance typed with the `TOtelMate` fields (`otelIgnoreSpan`, `otelIgnoreMeter`).

## Composables

All from `@moostjs/otel`; require an active event context (except `withSpan`/`useTrace`).

```ts
import { useOtelContext, useSpan, useTrace, useOtelPropagation } from '@moostjs/otel'

const {
  getSpan,                // root event span | undefined
  getSpanContext,         // { traceId, spanId, traceFlags, traceState } | undefined
  getPropagationHeaders,  // { traceparent?, tracestate? } — see gotcha 7
  registerSpan,           // set the root span for the current event
  pushSpan,               // make a span active; previous restored automatically on its end()
  customSpanAttr,         // ('key', value) → stamped on Moost-created spans (gotcha 6)
  customMetricAttr,       // ('key', value) → merged into duration-metric attributes
} = useOtelContext()

useSpan()            // shorthand for useOtelContext().getSpan()
useTrace()           // the OpenTelemetry trace API (no event context needed)
useOtelPropagation() // { traceId, spanId, traceFlags, traceState, headers }
```

Advanced: the event-context keys are exported too (`otelSpanKey`, `otelRouteKey`, `otelStartTimeKey`, `customSpanAttrsKey`, `customMetricAttrsKey`) — read/seed via `current()` from `moost`.

## withSpan

Wrap any unit of work (sync or async) in a child span — no event context required:

```ts
import { withSpan } from '@moostjs/otel'

const rows = await withSpan({ name: 'db-query' }, () => db.query('...')) // auto-ends, records exceptions
withSpan(existingSpan, cb)                                               // reuse a Span instead of creating one
withSpan({ name: 'x', options: { kind: SpanKind.CLIENT } }, cb,
  (span, err, res) => { span.setAttribute('rows', res?.length ?? 0); span.end() })
```

First arg: `TSpanInput` (`{ name, options? }`) or an existing `Span`. Third arg (`TPostSpanProcessFn`) is optional — when provided YOU must call `span.end()`.

## Gotchas

| # | Invariant |
|---|---|
| 1 | Register the global tracer provider AND (if exporting metrics) the global meter provider BEFORE `enableOtelForMoost()` — the meter is created at that call, and a meter obtained before registration is a permanent no-op (the metrics API has no proxy provider) |
| 2 | `@moostjs/event-http` is a hard peer dep — importing `@moostjs/otel` throws without it, even in CLI/WF-only apps |
| 3 | HTTP root spans are expected to come from `@opentelemetry/instrumentation-http` — the injector attaches to that server span (renamed `{METHOD} {route}`, e.g. `GET /users/:id`) instead of creating its own, patches `writeHead` to capture `http.status_code` for metrics, and `moost.event_type` is the lowercase `http`. Without HTTP instrumentation registered there is no root span to attach to. CLI (`CLI`) / WF (`WF`) create their own root spans |
| 4 | `@OtelIgnoreSpan()` only filters with `MoostBatchSpanProcessor`/`MoostSimpleSpanProcessor` — standard OTel processors export ignored spans anyway |
| 5 | Ignore decorators are additive (controller OR handler) — a decorated controller cannot be overridden per-handler |
| 6 | `customSpanAttr()` stamps each Moost-created span that ends after the call — call it early; spans created by external instrumentation never receive these attributes |
| 7 | `getPropagationHeaders()` is not strictly W3C-compliant (`traceFlags` unpadded decimal, `tracestate` is a `TraceState` object that stringifies to `[object Object]`) — use `propagation.inject(context.active(), headers)` from `@opentelemetry/api` for real propagation |
| 8 | `WF_STEP` and `__SYSTEM__` (404 fallback) handlers skip only root-span renaming + metric attribution — their lifecycle spans are still emitted unless `@OtelIgnoreSpan()` applies |
| 9 | `moost.ignore` is `true` or absent — never `false`; filter with `=== true` semantics |
