# @moostjs/otel

OpenTelemetry integration for [Moost](https://moost.org). Provides automatic tracing for event handlers, custom span creation, metrics collection, and trace propagation. Works by replacing Moost's context injector with a span-aware implementation.

## Installation

```bash
npm install @moostjs/otel @opentelemetry/api @opentelemetry/sdk-trace-base
```

## Quick Start

```ts
import { enableOtelForMoost } from '@moostjs/otel'

// Call before creating your Moost app
enableOtelForMoost()
```

## Composables

- `useOtelContext()` — Access tracing utilities (span, propagation headers, custom attributes).
- `useTrace()` — Get the OpenTelemetry `trace` API.
- `useSpan()` — Get the current event's root span.
- `useOtelPropagation()` — Get W3C trace-context headers for outgoing requests.

## Decorators

- `@OtelIgnoreSpan()` — Suppress span export for a controller or handler.
- `@OtelIgnoreMeter()` — Suppress metrics for a controller or handler.

## Span Processors

- `MoostBatchSpanProcessor` — Batch processor that respects `@OtelIgnoreSpan()`.
- `MoostSimpleSpanProcessor` — Simple processor that respects `@OtelIgnoreSpan()`.

## [Official Documentation](https://moost.org/moost/otel)

## License

MIT
