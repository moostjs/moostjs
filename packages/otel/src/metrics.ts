import type { Histogram } from '@opentelemetry/api'
import { metrics } from '@opentelemetry/api'

let moostMetrics:
  | {
      moostEventDuration: Histogram
    }
  | undefined

export function getMoostMetrics() {
  if (!moostMetrics) {
    const meter = metrics.getMeter('moost-meter')
    moostMetrics = {
      moostEventDuration: meter.createHistogram('moost.event.duration', {
        description: 'Moost Event Duration Histogram',
        unit: 'ms',
      }),
    }
  }
  return moostMetrics
}
