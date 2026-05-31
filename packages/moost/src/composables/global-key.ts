import type { Key } from '@wooksjs/event-core'
import { key } from '@wooksjs/event-core'

import type { TAny } from '../common-types'

// Context keys created by `@wooksjs/event-core`'s `key()` are identified by a
// module-scoped numeric id, NOT by their name. If moost is loaded more than once
// in a process — its ESM and CJS builds together (dual-package hazard), or two
// installed copies after a drifted/deduped install — each load mints a fresh id
// for the same logical slot. The copy that SETS the value and the copy that READS
// it then disagree, and `EventContext.get` throws `Key "..." is not set` at request
// time (clean boot, 100% request failure).
//
// Interning every moost-owned key through a single globalThis registry keyed by
// name makes all loads share one `Key` instance (one id), so set/get agree.
//
// Caveats (intentional, do not "fix"):
// - The registry is never cleared. Under vite HMR the moost module may reload
//   while this Map persists — that is what lets keys survive a reload. Clearing it
//   would re-introduce the id mismatch.
// - Names alias to ids: two different logical slots must never reuse one name, or
//   they silently collide on the same id. moost's names are all distinct.
// - This does NOT cover two copies of `@wooksjs/event-core` itself (each has its
//   own id counter) — that requires a single deduped event-core install.
const g = globalThis as TAny
const registry: Map<string, Key<TAny>> = (g.__moost_keys ??= new Map())

/**
 * Creates a typed event-context key that stays a single instance across duplicate
 * moost loads (dual ESM/CJS, or duplicate installs). Use this for every
 * moost-owned context key instead of `key()` directly.
 *
 * @param name - Debug label AND the registry lookup key; must be unique per slot.
 */
export function globalKey<T>(name: string): Key<T> {
  if (!registry.has(name)) {
    registry.set(name, key<T>(name))
  }
  return registry.get(name) as Key<T>
}
