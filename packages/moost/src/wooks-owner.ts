import type { Moost } from './moost'

/** A claim of {@link claimWooks}: the app, and whether its adapter created its Wooks app. */
interface TWooksClaim {
  app: Moost
  created: boolean
}

/** Per Wooks instance: the first claim of each adapter (by `name`) bound into it. */
const owners = new WeakMap<object, Map<string, TWooksClaim>>()
/** Wooks instances already warned about: the warning is logged once per instance. */
const warned = new WeakSet<object>()

/** The options of {@link claimWooks}. */
export interface TClaimWooksOptions {
  /**
   * The adapter created its Wooks app itself (none was passed in), so it routes through the
   * process-wide global Wooks. Default `false`: an app passed in — sharing it is deliberate.
   */
  created?: boolean
}

/**
 * Records that `app` binds the handlers of its `adapter` (the adapter's `name`) into `wooks`
 * (the Wooks instance its routes go to: `wooksApp.getWooks()`). Adapters call it from `onInit`.
 *
 * Adapters created without a Wooks app of their own share the process-wide global Wooks, so two
 * apps in one process (typically in tests) route through one router. When another app already
 * bound handlers of the same adapter into `wooks`, and either adapter created its Wooks app
 * (`opts.created`), it warns — once per Wooks instance, with the app's logger. Apps that share
 * a Wooks app they pass in on purpose stay silent; re-initialising the same app does not warn.
 * A disposed app still counts: `dispose()` does not remove its routes.
 */
export function claimWooks(
  app: Moost,
  wooks: object,
  adapter: string,
  opts?: TClaimWooksOptions,
): void {
  const created = opts?.created === true
  let byAdapter = owners.get(wooks)
  if (!byAdapter) {
    byAdapter = new Map()
    owners.set(wooks, byAdapter)
  }
  const owner = byAdapter.get(adapter)
  if (owner === undefined) {
    byAdapter.set(adapter, { app, created })
  } else if (owner.app !== app && (created || owner.created) && !warned.has(wooks)) {
    warned.add(wooks)
    app
      .getLogger()
      .warn(
        `[moost] A second Moost app binds "${adapter}" handlers into the Wooks instance another ` +
          `app already uses (adapters created without their own Wooks app share the ` +
          `process-wide global one). Both apps' routes now live in one router: an event on a ` +
          `route both register runs the first app's handler chain, and when that throws, its ` +
          `error is swallowed and the next app's chain runs instead. Call clearGlobalWooks() ` +
          `before creating each app (e.g. in a test's beforeEach): the next adapter then gets ` +
          `a fresh Wooks. (Logged once per Wooks instance.)`,
      )
  }
}
