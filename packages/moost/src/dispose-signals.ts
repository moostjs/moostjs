import type { TConsoleBase } from '@prostojs/logger'

import { errorMessage } from './dispose'

/**
 * Minimal app surface {@link registerDisposeOnSignals} needs — `Moost`
 * satisfies it structurally, so this module never imports the class (and
 * `moost.ts` keeps importing this one).
 */
interface TDisposableApp {
  dispose: () => Promise<void>
  getLogger: (topic?: string) => TConsoleBase
}

/**
 * The single process-wide signal registration behind `Moost.disposeOnSignals()`.
 * `app` always points at the newest app that asked for it, `listeners` holds the
 * one listener per signal that was actually added to `process`.
 */
interface TDisposeSignalsRecord {
  app: TDisposableApp
  listeners: Map<NodeJS.Signals, () => void>
}

type TSignalsGlobal = Record<symbol, TDisposeSignalsRecord | undefined>

/**
 * Global key for the record above. Global (rather than module-scoped) for the
 * same reason the module-identity stamp is: two copies of moost, or the entry
 * re-executing under the `@moostjs/vite` dev server, must share one set of
 * process listeners instead of stacking one per app.
 */
const DISPOSE_SIGNALS_KEY = Symbol.for('moost:dispose-on-signals')

/**
 * Removes every registered listener and forgets the record. A no-op for a record
 * that is no longer the live one (a stale unregister fn, or a signal that already
 * dropped it).
 */
function dropSignalsRecord(record: TDisposeSignalsRecord): void {
  const holder = globalThis as TSignalsGlobal
  if (holder[DISPOSE_SIGNALS_KEY] !== record) {
    return
  }
  for (const [signal, listener] of record.listeners) {
    process.off(signal, listener)
  }
  record.listeners.clear()
  delete holder[DISPOSE_SIGNALS_KEY]
}

/**
 * The one listener body per signal (NestJS `enableShutdownHooks` semantics):
 * unhook every listener first, dispose the newest app, then re-raise `signal`
 * so the process exits with Node's default status for it. Because the listeners
 * are already gone, a second signal while disposal runs gets Node's default
 * handling (exit `128 + n`) — an impatient Ctrl-C is never stuck.
 */
async function onSignal(signal: NodeJS.Signals): Promise<void> {
  const record = (globalThis as TSignalsGlobal)[DISPOSE_SIGNALS_KEY]
  if (!record) {
    return
  }
  const { app } = record
  dropSignalsRecord(record)
  try {
    await app.dispose()
  } catch (error) {
    app.getLogger().warn(`[moost] dispose on ${signal} failed: ${errorMessage(error)}`)
  }
  process.kill(process.pid, signal)
}

/**
 * @internal Backs `Moost.disposeOnSignals()` — see that method's JSDoc for the
 * full contract. Registers at most one process listener per signal, ever, and
 * re-targets the existing ones at `app`.
 */
export function registerDisposeOnSignals(
  app: TDisposableApp,
  signals: NodeJS.Signals[],
): () => void {
  const holder = globalThis as TSignalsGlobal
  const record = (holder[DISPOSE_SIGNALS_KEY] ??= { app, listeners: new Map() })
  record.app = app
  for (const signal of signals) {
    if (record.listeners.has(signal)) {
      continue
    }
    const listener = () => {
      void onSignal(signal)
    }
    record.listeners.set(signal, listener)
    process.on(signal, listener)
  }
  return () => {
    dropSignalsRecord(record)
  }
}
