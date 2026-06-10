# Metrics

`@moostjs/otel` automatically collects event duration metrics using an OpenTelemetry histogram. Metrics are recorded when each event completes, capturing timing, route, event type, and error status.

## Auto-collected metric

### `moost.event.duration`

A histogram that records the duration of each event in milliseconds.

| Property | Value |
|----------|-------|
| **Meter** | `moost-meter` |
| **Instrument** | Histogram |
| **Unit** | `ms` |
| **Description** | `Moost Event Duration Histogram` |

Every completed event (HTTP request, CLI command, workflow execution) records a single data point to this histogram.

## Recorded attributes

Each metric data point includes these attributes:

| Attribute | Type | Description |
|-----------|------|-------------|
| `route` | `string` | The matched route (e.g. `/users/:id`) |
| `moost.event_type` | `string` | Event type: `http`, `CLI`, `WF`, etc. |
| `moost.is_error` | `number` | `1` if the event resulted in an error, `0` otherwise |

### HTTP-specific attributes

For HTTP events, two additional attributes are recorded (the status code is captured automatically — no extra setup), and `route` falls back to the raw URL when no route matched:

| Attribute | Type | Description |
|-----------|------|-------------|
| `http.status_code` | `number` | Response status code (e.g. `200`, `404`, `500`) |
| `moost.is_error` | `number` | Also set to `1` if `http.status_code > 399` |

::: info
For HTTP events, `moost.event_type` is the lowercase `http`.
:::

## Custom metric attributes

Add custom attributes to the event metrics from within your handler code using `customMetricAttr()`:

```ts
import { useOtelContext } from '@moostjs/otel'

@Get('users/:id')
async getUser(@Param('id') id: string) {
  const { customMetricAttr } = useOtelContext()

  customMetricAttr('tenant.id', 'acme-corp')
  customMetricAttr('cache.hit', 0)

  const user = await db.users.findById(id)

  customMetricAttr('cache.hit', 1) // Override — last value wins
  return user
}
```

Custom attributes are merged with the auto-collected attributes when the metric is recorded. They can be strings or numbers.

## Suppressing metrics

Use the `@OtelIgnoreMeter()` decorator to suppress metrics for specific controllers or handlers:

```ts
import { Controller } from 'moost'
import { Get } from '@moostjs/event-http'
import { OtelIgnoreMeter } from '@moostjs/otel'

// Suppress metrics for the entire controller
@Controller('health')
@OtelIgnoreMeter()
class HealthController {
  @Get()
  check() {
    return { status: 'ok' }
  }
}
```

Handler-level decorator:

```ts
@Controller('api')
class ApiController {
  @Get('status')
  @OtelIgnoreMeter()
  status() {
    // No metrics recorded for this endpoint
    return { ok: true }
  }

  @Get('users')
  users() {
    // Metrics ARE recorded for this endpoint
    return []
  }
}
```

## Metrics SDK setup

To export metrics, configure the OpenTelemetry Metrics SDK alongside the tracing SDK. The exact setup depends on your metrics backend and infrastructure — the example below is one possible configuration using OTLP over HTTP.

```ts
// Example — adjust for your metrics backend
import { metrics } from '@opentelemetry/api'
import { MeterProvider, PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics'
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http'

const meterProvider = new MeterProvider({
  readers: [
    new PeriodicExportingMetricReader({
      exporter: new OTLPMetricExporter({
        url: 'http://localhost:4318/v1/metrics',
      }),
      exportIntervalMillis: 10000,
    }),
  ],
})

// Register globally BEFORE calling enableOtelForMoost()
metrics.setGlobalMeterProvider(meterProvider)
```

The `moost-meter` meter and the duration histogram are created when `enableOtelForMoost()` runs, using OpenTelemetry's **global** meter provider. Register the global meter provider first: unlike the tracing API, the metrics API has no proxy provider, so a meter created before registration stays a no-op and no metrics are ever exported. See the [OpenTelemetry Metrics SDK docs](https://opentelemetry.io/docs/languages/js/instrumentation/#metrics) for other configuration options.

## Example: Grafana dashboard query

With metrics exported to Prometheus (via OTLP), you can query event durations:

```txt
# p95 request duration by route
histogram_quantile(0.95,
  sum(rate(moost_event_duration_bucket{moost_event_type="http"}[5m])) by (le, route)
)

# Error rate by route
sum(rate(moost_event_duration_count{moost_is_error="1"}[5m])) by (route)
/
sum(rate(moost_event_duration_count[5m])) by (route)
```
