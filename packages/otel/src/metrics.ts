import type { Counter, Histogram } from '@opentelemetry/api'
import { metrics } from '@opentelemetry/api'

let moostMetrics: {
  httpRequestCount: Counter
  httpResponseCount: Counter
  httpActiveRequests: Counter
  httpRequestSize: Histogram
  httpResponseSize: Histogram
  httpErrorCount: Counter
  moostEventCount: Counter
  moostActiveEvents: Counter
  moostErrorCount: Counter
}

export function getMoostMetrics() {
  if (!moostMetrics) {
    const meter = metrics.getMeter('moost-meter')
    moostMetrics = {
      httpRequestCount: meter.createCounter('http.server.requests', {
        description: 'The number of HTTP requests received',
      }),

      httpResponseCount: meter.createCounter('http.server.responses', {
        description: 'The number of HTTP responses sent',
      }),

      httpActiveRequests: meter.createUpDownCounter('http.server.active_requests', {
        description: 'The number of active HTTP requests',
      }),

      httpRequestSize: meter.createHistogram('http.server.request.size', {
        description: 'The size of HTTP request bodies',
        unit: 'byte',
      }),

      httpResponseSize: meter.createHistogram('http.server.response.size', {
        description: 'The size of HTTP response bodies',
        unit: 'byte',
      }),

      httpErrorCount: meter.createCounter('http.server.errors', {
        description: 'The number of HTTP requests that resulted in an error',
      }),

      moostEventCount: meter.createCounter('moost.events.count', {
        description: 'The number of HTTP requests received',
      }),

      moostActiveEvents: meter.createUpDownCounter('moost.events.active', {
        description: 'The number of active HTTP requests',
      }),

      moostErrorCount: meter.createCounter('moost.events.errors', {
        description: 'The number of HTTP requests that resulted in an error',
      }),
    }
  }
  return moostMetrics
}
