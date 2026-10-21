import type { WooksWf } from '@wooksjs/event-wf'
import { getMoostInfact, useScopeId } from 'moost'

/** Marks a `WooksWf` whose runs release their moost DI scope (see {@link releaseRunScopes}). */
const RUN_SCOPES_RELEASED = Symbol.for('moost-wf.run-scopes-released')
/** Marks the cleanup that releases a run's scope, so a resumed run does not wrap it twice. */
const RUN_SCOPE_CLEANUP = Symbol.for('moost-wf.run-scope-cleanup')

type TRunCleanup = (() => void) & { [RUN_SCOPE_CLEANUP]?: true }

/** Run options whose `cleanup` also releases the run's moost DI scope (when the run ends). */
function withRunScopeCleanup<O extends { cleanup?: TRunCleanup }>(opts?: O): O {
  const own = opts?.cleanup
  if (own?.[RUN_SCOPE_CLEANUP]) {
    return opts as O
  }
  const cleanup: TRunCleanup = () => {
    // runs inside the workflow event context. The caller's cleanup first, while the run's
    // scope (held by the steps across the run) still resolves FOR_EVENT instances.
    try {
      own?.()
    } finally {
      getMoostInfact().unregisterScope(useScopeId())
    }
  }
  cleanup[RUN_SCOPE_CLEANUP] = true
  return { ...opts, cleanup } as O
}

/**
 * Makes every run of `wfApp` release its moost DI scope when it ends — whoever starts it:
 * `MoostWf.start()`, `getWfApp().start()`, an outlet trigger or `mintWfToken()`. Step handlers
 * keep the run's scope (`FOR_EVENT` instances) alive across steps, so the run end releases it.
 * Replaces the instance's `start`/`resume`: anything that captured them before (e.g. a
 * `createOutletHandler(wooksWf)` made before `new MoostWf(wooksWf)`) bypasses the release.
 */
export function releaseRunScopes(wfApp: WooksWf) {
  const app = wfApp as WooksWf & { [RUN_SCOPES_RELEASED]?: true }
  if (app[RUN_SCOPES_RELEASED]) {
    return
  }
  app[RUN_SCOPES_RELEASED] = true
  const { start, resume } = app
  app.start = function (schemaId, context, opts) {
    return start.call(this, schemaId, context, withRunScopeCleanup(opts))
  }
  app.resume = function (state, opts) {
    return resume.call(this, state, withRunScopeCleanup(opts))
  }
}
