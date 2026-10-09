import type { Accessor, EventContext } from '@wooksjs/event-core'
import {
  cached,
  current,
  EventContext as WooksEventContext,
  run,
  tryGetCurrent,
} from '@wooksjs/event-core'

import { setControllerContext } from './composables/controller.composable'
import { getMoostInfact } from './metadata'
import { isThenable } from './shared-utils'

// Monotonic scope ID counter — avoids randomUUID() crypto overhead.
// On overflow, increment alphabetic prefix and reset counter.
let _scopeChar = 'a'
let _scopeNum = 0
function nextScopeId(): string {
  if (_scopeNum >= Number.MAX_SAFE_INTEGER) {
    _scopeNum = 0
    _scopeChar =
      _scopeChar === 'z' ? 'a' : String.fromCodePoint((_scopeChar.codePointAt(0) ?? 97) + 1)
  }
  return `__moost_${_scopeChar}_${++_scopeNum}`
}

/**
 * The DI scope of an event. A handler lifecycle holds it without touching the DI container:
 * the scope is registered on the first `FOR_EVENT` resolution that needs it, so the many
 * events that never resolve a `FOR_EVENT` class skip registering and dropping it.
 * @internal
 */
export interface TEventScope {
  readonly id: string
  /** A handler lifecycle holds the scope: the next `FOR_EVENT` resolution registers it. */
  held: boolean
  /** Registered in the DI container (on demand, or directly — see {@link syncEventScope}). */
  registered: boolean
}

const eventScopeSlot = cached(
  (): TEventScope => ({ id: nextScopeId(), held: false, registered: false }),
)

/**
 * The DI scope of an event (see {@link useScopeId}) — cached on the event context itself.
 * @internal
 */
export const getEventScope = (ctx?: EventContext): TEventScope =>
  (ctx ?? current()).getOwn(eventScopeSlot)

/**
 * Composable returning the moost DI scope ID of the current event. Generated on first call
 * and cached on the event context itself — never inherited from a parent context, so a child
 * event (a workflow run started with `eventContext`, a WebSocket message) owns its scope
 * instead of sharing, and later releasing, its parent's.
 */
export const useScopeId = (ctx?: EventContext): string => getEventScope(ctx).id

/**
 * Holds the event scope for a handler lifecycle — registering it, deferred to the first
 * `FOR_EVENT` resolution (see {@link resolveEventScopeId}). Returns the release, which drops
 * the scope like the release of an eager registration.
 * @internal
 */
export function holdEventScopeLazily(scope: TEventScope): () => void {
  scope.held = true
  return () => {
    scope.held = false
    if (scope.registered) {
      scope.registered = false
      getMoostInfact().unregisterScope(scope.id)
    }
  }
}

/**
 * The scope id a `FOR_EVENT` resolution in the current event uses: a held scope is registered
 * in the DI container now, on first use.
 * @internal
 */
export function resolveEventScopeId(): string {
  const scope = getEventScope()
  if (scope.held && !scope.registered) {
    scope.registered = true
    getMoostInfact().registerScope(scope.id)
  }
  return scope.id
}

/**
 * Keeps the current event's scope state in step with a direct `registerScope` /
 * `unregisterScope` of its id on the moost DI container — `registerEventScope(useScopeId())`,
 * or an adapter's `cleanup: () => getMoostInfact().unregisterScope(useScopeId())`. As with an
 * eager registration: a registered scope is dropped with the handler lifecycle, and an
 * unregistered one stays gone for the rest of the lifecycle (a later `FOR_EVENT` resolution
 * fails instead of registering it again — and leaking it, when nothing releases it after).
 * @internal
 */
export function syncEventScope(scopeId: string | symbol, registered: boolean): void {
  const ctx = tryGetCurrent()
  const scope = ctx?.hasOwn(eventScopeSlot) ? ctx.getOwn(eventScopeSlot) : undefined
  if (scope?.id === scopeId) {
    scope.registered = registered
    if (!registered) {
      scope.held = false
    }
  }
}

/** Registers a DI scope for the given ID and returns an unscope function. */
export function registerEventScope(scopeId: string) {
  const infact = getMoostInfact()
  infact.registerScope(scopeId)
  return () => {
    infact.unregisterScope(scopeId)
  }
}

// ── Child event contexts ─────────────────────────────────────────────────────

/** A slot a child context must not read through from its parent: a `key()` / `cached()` slot, or a `defineWook` composable. */
export type TIsolatedSlot = Accessor<any> | { readonly _slot: Accessor<any> }

/** Options for {@link forkEventContext}. */
export interface TForkEventContextOptions {
  /** The context to fork. Default: the current event context. */
  parent?: EventContext
  /**
   * Slots the child never reads through from the parent — they are computed or stored in
   * the child only. Pass the per-event state the child must not inherit (a composable the
   * parent already built is bound to the parent's context).
   */
  isolate?: Iterable<TIsolatedSlot>
}

const NO_ISOLATION: ReadonlySet<number> = new Set()

/** Copy-on-write child: reads fall through to the parent, every write stays in the child. */
class ForkedEventContext extends WooksEventContext {
  constructor(
    parent: EventContext,
    private readonly isolated: ReadonlySet<number>,
  ) {
    super({ logger: parent.logger, parent })
  }

  override set<T>(slot: Accessor<T>, value: T): void {
    this.setOwn(slot, value)
  }

  protected override _shouldTraverseParent(id: number): boolean {
    return !this.isolated.has(id)
  }
}

/**
 * Creates a copy-on-write child of an event context. Reads fall through to the parent
 * (request, headers, auth, already computed slots); every write — `ctx.set()`, a controller
 * context, a composable's state — stays in the child, so running code in the child never
 * clobbers the parent event's state. The child owns its moost DI scope id (see
 * {@link withControllerContext} to share the parent's).
 *
 * Run code in it with `run(child, fn)`.
 *
 * @example
 * ```ts
 * const child = forkEventContext({ isolate: [useMyState] })
 * await run(child, () => doWork())
 * ```
 */
export function forkEventContext(opts?: TForkEventContextOptions): EventContext {
  const parent = opts?.parent ?? current()
  if (!opts?.isolate) {
    return new ForkedEventContext(parent, NO_ISOLATION)
  }
  const ids = new Set<number>()
  for (const slot of opts.isolate) {
    ids.add(('_slot' in slot ? slot._slot : slot)._id)
  }
  return new ForkedEventContext(parent, ids)
}

/** Options for {@link withControllerContext}. */
export interface TWithControllerContextOptions extends TForkEventContextOptions {
  /**
   * `true` (default): the child runs in the parent event's DI scope — `FOR_EVENT` instances
   * resolve to (and are shared with) the parent event's. The parent must be a moost event
   * whose handler is still running.
   *
   * `false`: the child gets its own DI scope, registered for the duration of `fn` and
   * released when `fn` settles — `FOR_EVENT` instances are fresh and dropped afterwards.
   */
  shareScope?: boolean
  /** The route reported by `useControllerContext().getRoute()` in the child. Default: `''`. */
  route?: string
  /** The prefix reported by `useControllerContext().getPrefix()` in the child. */
  prefix?: string
}

/**
 * Runs `fn` in a copy-on-write child of the current event (see {@link forkEventContext})
 * whose controller context is `instance` / `method` — another controller's hooks, permission
 * checks and `useControllerContext()` consumers run as if the event had been routed to it,
 * without touching the current event's state. `FOR_EVENT` dependencies resolve in the parent's
 * DI scope by default (`shareScope`).
 *
 * Use it to call into another controller's logic within the same event. Do not run a moost
 * event handler (a routed handler function) inside a scope-sharing child: a handler registers
 * and releases its own scope — use an adapter-level invocation (e.g. `MoostHttp.invoke()`) for that.
 *
 * @returns what `fn` returns (a promise stays a promise)
 *
 * @example
 * ```ts
 * const source = await useControllerContext().instantiate(IssueController)
 * const allowed = await withControllerContext(source, 'list', () => source.allowedFor(ids))
 * ```
 */
export function withControllerContext<T extends object, R>(
  instance: T,
  method: keyof T | string,
  fn: () => R,
  opts?: TWithControllerContextOptions,
): R {
  const parent = opts?.parent ?? current()
  const child = forkEventContext({ parent, isolate: opts?.isolate })
  setControllerContext(instance, method as keyof T, opts?.route ?? '', {
    prefix: opts?.prefix,
    ctx: child,
  })
  if (opts?.shareScope !== false) {
    child.setOwn(eventScopeSlot, getEventScope(parent))
    return run(child, fn)
  }
  const release = registerEventScope(useScopeId(child))
  let result: R
  try {
    result = run(child, fn)
  } catch (error) {
    release()
    throw error
  }
  if (!isThenable(result)) {
    release()
    return result
  }
  return Promise.resolve(result).finally(release) as R
}
