# Application Dispose (`@MoostDispose`)

`@MoostDispose()` marks a method to run **once when its instance is torn down** — the
teardown counterpart of [`@MoostInit`](/moost/app-init). A singleton that owns something
the process keeps alive — a cache client, a queue consumer, a database handle, a timer,
a file watcher — releases it here, so shutting the app down (or letting the dev server
replace the instance) does not leave the resource behind.

It runs on SINGLETON controllers **and** on any `@Injectable()` singleton, which is
where most owned resources actually live.

## Quick start

```ts
import { Moost, Controller, Injectable, MoostDispose } from 'moost'
import { Get } from '@moostjs/event-http'

@Injectable()
class CacheClient {
  private readonly client = createCacheClient()

  get(key: string) {
    return this.client.get(key)
  }

  @MoostDispose()
  async close() {
    await this.client.quit() // awaited — the app waits for it
  }
}

@Controller('api')
class ApiController {
  constructor(private readonly cache: CacheClient) {}

  @Get('config')
  config() {
    return this.cache.get('config')
  }
}
```

The provider is never mentioned at shutdown: Moost finds the hook on the live instance.

## When it runs

Two triggers, same hooks:

- **`Moost.dispose()`** — explicit graceful shutdown (below).
- **The [`@moostjs/vite`](/webapp/vite#hot-module-replacement) dev server** — when a hot
  reload ejects the instance, its hooks are awaited *before* the entry re-imports, so the
  replacement never opens a second copy of the same resource. This is the trigger process
  signals can never cover: no signal fires on HMR.

The dev-server trigger also covers a **partially failed start**: instances a boot constructed before
it threw stay in the registry and are disposed by the next reload, before the healthy boot builds
their replacements. **Repeated reloads** leave exactly one live runtime — every eject disposes the
instance it replaces, so recurring timers and consumers do not accumulate.

## Graceful shutdown

`disposeOnSignals()` wires the app to the process signals — one call, nothing to unwind:

```ts
const app = new Moost()
// ...
await app.init()

app.disposeOnSignals() // SIGTERM + SIGINT by default
```

On a signal it first removes its listeners, runs `dispose()`, and then **re-raises that same signal**
with nothing listening, so the process exits with Node's default status for it (`143` for SIGTERM,
`130` for SIGINT) rather than a hand-picked `0`. A **second** signal while the teardown is still
running therefore gets Node's default handling (the listeners are already gone — the process exits
right away with `128 + n`), so an impatient Ctrl-C is never stuck. A failing `dispose()` is logged as
a warning and the signal is re-raised all the same.

Pass your own list (`app.disposeOnSignals(['SIGTERM'])`) — signals are unioned across calls, never
replaced. The return value is a function that unregisters the listeners again (tests, embedded
runners).

Adapters stop taking new work first (see the table), then the hooks run, so in-flight
requests finish against resources that are still open.

::: tip Why not `process.once` in the entry
Under the [`@moostjs/vite`](/webapp/vite#hot-module-replacement) dev server the entry re-executes on
every reload, so a hand-written `process.once(signal, ...)` stacks one listener per dead app (Node
warns about a listener leak after ten) and Ctrl-C then disposes the *first* app instead of the live
one. `disposeOnSignals()` registers each listener once per process and re-targets it at the newest
app, which makes calling it from a re-executing entry safe.
:::

::: info Added in 0.6.37
`disposeOnSignals()` is new in 0.6.37. Earlier versions had no helper: the wiring had to be a
hand-written `process.once(signal, ...)` loop in the entry, with the dev-server caveat above.
:::

## Semantics

| Concern                 | Behavior                                                                                                                                                                                  |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **When**                | On `Moost.dispose()`, or when the `@moostjs/vite` dev server ejects the instance on hot reload.                                                                                             |
| **How often**           | At most once per instance, ever — tracked per instance, so a second `dispose()` (or an eject followed by a shutdown) runs nothing. `dispose()` itself is idempotent: later calls return the first call's promise. |
| **Scope**               | SINGLETON controllers and `@Injectable()` singletons. `@MoostDispose` on a `FOR_EVENT` **controller** throws at bind; on a `FOR_EVENT` **injectable** the hook is never invoked (per-event instances die with their event). |
| **Ordering**            | Every adapter's `onDispose` first, in registration order; then instance hooks in ascending `priority` (default `0`, lower first), ties in discovery order.                                   |
| **Arguments**           | **None.** Disposal tears down an existing instance — inject what it needs in the constructor.                                                                                                |
| **Async**               | Each hook is awaited, sequentially. Ordered teardown (drain the consumer, *then* close the connection it writes to) is expressed with `priority`.                                            |
| **Errors**              | Best effort: a throwing hook is logged and every remaining hook still runs. `dispose()` then rejects with an `AggregateError` naming each failing `Class.method`; a hot reload only warns and continues. |
| **`Symbol.asyncDispose`** | Honored — a class with no `@MoostDispose` method but an `[Symbol.asyncDispose]()` (preferred) or `[Symbol.dispose]()` method is disposed through it.                                       |
| **vs `adapter.onDispose`** | Adapters stop **intake** (close the server, stop the consumer loop); `@MoostDispose` releases what your own classes own. Adapters always go first.                                        |
| **DI registries**       | Untouched. `dispose()` does not clear the DI container or metadata caches.                                                                                                                  |

```ts
@MoostDispose({ priority: -10 }) // runs before default-priority hooks
drainQueue() {}
```

## DOs and DON'Ts

- **DO** make hooks idempotent and quick — they run on a shutdown path someone is waiting on.
- **DO** `await` every asynchronous teardown (`await client.quit()`), so the process does not exit mid-flush.
- **DO** put the hook on the class that **owns** the resource, not on a controller that merely uses it.
- **DON'T** rely on process signals to clean up during development — they never fire on a dev-server reload. If a resource leaks one handle per reload, its owner is missing a `@MoostDispose`.
- **DON'T** call request-scoped composables (`useRequest`, `useHeaders`, `useCookies`) — there is no event at disposal.
- **DON'T** put `@MoostDispose` on a `FOR_EVENT` controller — it throws at bind. Use the singleton that owns the resource.

## See also

- [Application Init](/moost/app-init) — the boot-time counterpart (`@MoostInit`).
- [Vite plugin — HMR](/webapp/vite#hot-module-replacement) — how ejected instances are disposed during development.
- [Dependency Injection](/moost/di/) — scopes, and which instances are singletons.
