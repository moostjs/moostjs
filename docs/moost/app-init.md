# Application Init (`@MoostInit`)

`@MoostInit()` marks a controller method to run **once at boot** — after Moost has
bound every controller (so the complete [`getControllersOverview()`](/moost/controllers)
is available) and **before** any adapter starts serving. It is the decorator-idiomatic
seam for one-time, post-wiring setup: warm a cache, validate configuration, or derive
a value from the final route table.

This is *application* init, not the per-[event lifecycle](/moost/event-lifecycle). There
is no request, no headers, no route params — just the wired app and dependency injection.

## Quick start

```ts
import { Moost, Controller, MoostInit, InjectMoost } from 'moost'

@Controller('api/auth')
class AuthController {
  @MoostInit()
  init(@InjectMoost() moost: Moost) {
    // The overview is COMPLETE here — every controller and its mounted routes.
    const overview = moost.getControllersOverview()
    moost.getLogger('auth').log(`wired ${overview.length} controllers`)
  }
}
```

## Why not the constructor?

A singleton controller's constructor runs **during** bind, *before* its own entry is
pushed to the overview. So a constructor that calls `getControllersOverview()` sees an
**incomplete** table (missing its own controller and everything bound after it).
`@MoostInit` runs after *all* controllers are bound, so the overview is always complete.

The classic case: an integration must scope something to a controller's **actual** mounted
path. Mount prefixes compose at bind time (`registerControllers(['api/auth', AuthController])`
→ `/api/auth/refresh`), so the path can only be read from the final, composed route table.
Use the [`@HandlerPaths`](#resolving-a-handler-path) param decorator instead of
walking the overview by hand:

```ts
@Controller('auth')
class AuthController {
  constructor(private readonly holder: RefreshPathHolder) {}

  @Get('refresh')
  refresh() { /* ... */ }

  @MoostInit()
  resolveRefreshPath(@HandlerPaths('refresh') paths: string[], @InjectMoost() moost: Moost) {
    if (paths.length) this.holder.value = paths[0]    // '/api/auth/refresh', composed
    else moost.getLogger('auth').warn('refresh route not found') // warns at BOOT, not first request
  }
}
```

## Accessing the app

Both inject the running `Moost` instance:

- **`@InjectMoost()`** — a parameter decorator on the init method (shown above).
- **Constructor injection** — `Moost` is in the provide registry, so `constructor(private moost: Moost) {}`
  works on any singleton controller.

## Resolving a handler path

Deriving a handler's *actual* mounted path is common enough that Moost ships a helper for it, so you don't navigate `getControllersOverview()` by hand (and don't trip over the multiplicities below). Three forms, smallest first:

```ts
import { getHandlerPaths, useHandlerPaths, HandlerPaths } from 'moost'

// 1. Param decorator — inject directly into a @MoostInit method
@MoostInit()
init(@HandlerPaths('refresh') paths: string[]) { /* paths = ['/api/auth/refresh'] */ }

// 2. Composable — inside the method body; defaults the controller to the current one
@MoostInit()
async init() { const paths = await useHandlerPaths('refresh') }

// 3. Pure function — explicit controller + method, callable anywhere with a Moost ref
@MoostInit()
init(@InjectMoost() moost: Moost) { const paths = getHandlerPaths(moost, AuthController, 'refresh') }
```

All three **return all distinct mounted paths** (`string[]`), because a single method can resolve to more than one path:

- the controller is mounted at **multiple prefixes** (`@ImportController` in several places);
- the method carries **multiple verbs** (`@Get` + `@Post`);
- a handler registers under **multiple paths**.

Pass `opts.predicate` to narrow by event-specific criteria without coupling core to a transport — e.g. only the GET registration: `getHandlerPaths(moost, AuthController, 'refresh', { predicate: (h) => (h.handler as { method: string }).method === 'GET' })`. Use `opts.type` (e.g. `'HTTP'`) to restrict by event type. Returns `[]` when nothing matches — check it and warn at boot.

## Semantics

| Concern          | Behavior                                                                                                                                            |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| **When**         | After all controllers are bound, before the `adapter.onInit` loop. The full overview is guaranteed complete.                                         |
| **How often**    | Exactly once per `init()`.                                                                                                                           |
| **Scope**        | SINGLETON controllers only. `@MoostInit` on a `FOR_EVENT` controller throws at bind (there is no init-time instance).                                |
| **Ordering**     | Ascending `priority` (default `0`), then registration order — same mental model as [interceptor](/moost/interceptors) priority. Lower runs first.    |
| **Arguments**    | Resolved through the [resolve pipe](/moost/pipes/resolve) **only** — `@InjectMoost`, `@Inject`, `@Const`, and other `@Resolve`-based params work.    |
| **Interceptors** | **Not** applied. Guards/auth/error interceptors are request concerns; init hooks call the method directly.                                           |
| **Transform/Validate pipes** | **Not** applied — only the resolve pipe runs. Injected values are not validated or transformed.                                          |
| **Async**        | Each hook is awaited.                                                                                                                                |
| **Errors**       | Fail-fast: a throwing hook rejects `init()`. A broken one-time setup is a boot-time misconfiguration you want loud.                                  |
| **vs `adapter.onInit`** | `@MoostInit` runs **before** adapter `onInit`, so an adapter's `onInit` can observe state an init hook produced.                              |

```ts
@MoostInit({ priority: -10 }) // runs before default-priority hooks
earlySetup() {}
```

## DOs and DON'Ts

- **DO** use it for one-time setup that depends on the complete overview — deriving paths, warming caches, validating config.
- **DO** put the result somewhere request handlers can read it (an injectable holder), rather than recomputing per request.
- **DON'T** call request-scoped composables (`useRequest`, `useHeaders`, `useRouteParams`, `useCookies`) — there is no event at init; they will fail.
- **DON'T** put `@MoostInit` on a `FOR_EVENT` controller — it throws at bind. Use a SINGLETON.
- **DON'T** rely on it for per-request logic — it runs once at boot, not per event.

## See also

- [Event Lifecycle](/moost/event-lifecycle) — the per-event flow (`@MoostInit` is the boot-time counterpart).
- [Controllers](/moost/controllers) — `getControllersOverview()` and how controllers are registered.
- [Dependency Injection](/moost/di/) — how `@InjectMoost` and constructor injection resolve.
