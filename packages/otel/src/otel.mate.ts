import { getMoostMate } from 'moost'
import type { TMoostMetadata, Mate, TMateParamMeta } from 'moost'

/** OpenTelemetry metadata fields attached to classes and methods by OTEL decorators. */
export interface TOtelMate {
  otelIgnoreSpan: boolean
  otelIgnoreMeter: boolean
}

/** Returns the shared `Mate` instance extended with OpenTelemetry metadata fields. */
export function getOtelMate(): Mate<
  TMoostMetadata &
    TOtelMate & {
      params: (TOtelMate & TMateParamMeta)[]
    },
  TMoostMetadata &
    TOtelMate & {
      params: (TOtelMate & TMateParamMeta)[]
    }
> {
  return getMoostMate<TOtelMate, TOtelMate, TOtelMate>()
}
