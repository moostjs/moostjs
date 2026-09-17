import { getMoostMate } from '../metadata/moost-metadata'

/**
 * ## MoostDispose
 * ### @Decorator
 * Marks a method to run **once**, when its instance is **disposed** — either by
 * `Moost.dispose()` (graceful shutdown) or by the `@moostjs/vite` dev server
 * when the instance is ejected on hot reload. It is the teardown counterpart of
 * {@link MoostInit}: release what the singleton owns (a queue consumer, a cache
 * client, a database handle, timers, watchers) so a replaced instance does not
 * leak it.
 *
 * Works on SINGLETON controllers **and** on any `@Injectable()` singleton — the
 * hooks are discovered from live instances at dispose time, so a provider that
 * owns a connection is covered without being a controller.
 *
 * The method takes **no arguments** (dispose tears down an existing instance —
 * inject whatever it needs in the constructor). Async methods are awaited.
 * Errors are collected, not fatal: every other hook still runs, `Moost.dispose()`
 * then rejects with an `AggregateError`, and a hot reload only warns.
 *
 * An instance is disposed at most once (tracked per instance), so a second
 * `dispose()` — or an eject followed by a shutdown — never re-runs a hook.
 *
 * When a class defines no `@MoostDispose` method but exposes
 * `[Symbol.asyncDispose]()` / `[Symbol.dispose]()`, that is used instead.
 *
 * Applying `@MoostDispose` to a `FOR_EVENT` **controller** is a configuration
 * error and throws at bind time (per-event instances are torn down with their
 * event — put the hook on the singleton that owns the resource). On a
 * `FOR_EVENT` **injectable** the hook is simply never invoked.
 *
 * @param opts.priority lower runs first across all `@MoostDispose` methods (default 0)
 *
 * @example
 * ```ts
 * │  @Injectable()
 * │  export class CacheClient {
 * │    private readonly client = createCacheClient()
 * │
 * │    @MoostDispose()
 * │    async close() {
 * │      await this.client.quit()
 * │    }
 * │  }
 * ```
 */
export function MoostDispose(opts?: { priority?: number }): MethodDecorator {
  return getMoostMate().decorate('moostDispose', { priority: opts?.priority ?? 0 }, false)
}
