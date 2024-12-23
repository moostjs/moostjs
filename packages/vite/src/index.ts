import { getGlobalWooks, getMoostInfact, getMoostMate } from 'moost'

export function devCleanupOnRestart() {
  getMoostInfact()._cleanup()
  getMoostMate()._cleanup()
  getGlobalWooks(undefined, undefined, 'cleanup')
}
