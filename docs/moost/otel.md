# OpenTelemetry in Moost

`@moostjs/otel` integrates [OpenTelemetry](https://opentelemetry.io/) with Moost, providing automatic distributed tracing and metrics collection. It hooks into Moost's context injector system to wrap every event lifecycle phase in spans without manual instrumentation.

For the full documentation, visit the dedicated **[OpenTelemetry module section](/otel/)**.

## Quick links

| Page | What you'll learn |
|------|-------------------|
| [Overview & Quick Start](/otel/) | Installation, setup, and how it works |
| [Setup & Configuration](/otel/setup) | SDK configuration, exporters, span processors, and filtering decorators |
| [Automatic Spans](/otel/spans) | Every span Moost creates, their names, attributes, and lifecycle mapping |
| [Composables](/otel/composables) | `useOtelContext()`, `useSpan()`, `useOtelPropagation()`, child spans, and custom attributes |
| [Metrics](/otel/metrics) | Auto-collected duration histogram, attributes, and custom metric attributes |
