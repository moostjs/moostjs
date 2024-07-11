import { getMoostMate } from '@moostjs/moost'

export interface TOtelMate {
  otelIgnoreSpan: boolean
}

export function getOtelMate() {
  return getMoostMate<TOtelMate, TOtelMate, TOtelMate>()
}
