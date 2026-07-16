/**
 * Duplicate-copy detection for moost
 *
 * Mate stores decorator metadata in WeakMaps keyed by constructor
 * reference, and moost keeps module-scoped DI singletons
 * (`sharedMoostInfact`, `moostMate`). If a bundler loads two copies of
 * moost, decorators run against one copy while lookups hit the other,
 * and DI fails with distant "Class is not Injectable" errors. The first
 * loaded copy stamps `globalThis` under a global symbol; any subsequent
 * copy finds the stamp and warns.
 */

export const MOOST_MODULE_IDENTITY_KEY = Symbol.for('moost:module-identity')

export interface TMoostModuleIdentity {
  version?: string
  path?: string
}

function describeCopy(identity: TMoostModuleIdentity): string {
  return `${identity.version || 'unknown version'} at ${identity.path || 'unknown path'}`
}

/**
 * Stamps the global object with this module's identity and warns when
 * another copy of moost was already loaded — decorator metadata and DI
 * singletons do not interoperate between copies.
 *
 * Exported for testability; invoked once at module scope.
 */
export function stampModuleIdentity(
  identity: TMoostModuleIdentity,
  globalObject: object = globalThis,
): void {
  const holder = globalObject as Record<symbol, TMoostModuleIdentity | undefined>
  const existing = holder[MOOST_MODULE_IDENTITY_KEY]
  if (existing) {
    // oxlint-disable-next-line no-console -- fires at module load, before any logger exists
    console.warn(
      `[moost] A second copy of moost was loaded (${describeCopy(existing)}, ` +
        `now ${describeCopy(identity)}). Decorator metadata and DI singletons ` +
        'will NOT interoperate between copies. Check your bundler config / dedupe settings.',
    )
  } else {
    holder[MOOST_MODULE_IDENTITY_KEY] = identity
  }
}

let stamped = false

/**
 * One-shot wrapper around `stampModuleIdentity` for this module copy.
 *
 * Invoked at module scope AND from `getMoostMate()`: the package ships
 * `"sideEffects": false`, so a tree-shaking bundler may drop the
 * module-scope invocation when nothing imports from this file — the
 * `getMoostMate()` call keeps the duplicate check reachable in bundled
 * apps (it fires on first decorator use, exactly when per-copy metadata
 * divergence begins), which are the environments that produce duplicate
 * copies in the first place.
 */
export function stampOnce(): void {
  if (stamped) {
    return
  }
  stamped = true
  stampModuleIdentity({
    version: typeof __VERSION__ === 'string' ? __VERSION__ : undefined,
    // `typeof` is safe on the undeclared `__filename` in ESM; in the CJS
    // bundle it is defined and wins (rolldown also shims `import.meta.url` there)
    path: typeof __filename === 'string' ? __filename : import.meta.url,
  })
}

stampOnce()
