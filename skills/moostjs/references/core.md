# Core — moost

Moost lifecycle, controller registration, adapter attachment.

- [Scaffold](#scaffold)
- [Mental model](#mental-model)
- [Lifecycle](#lifecycle)
- [App init (`@MoostInit`)](#app-init-moostinit)
- [API](#api)
- [Patterns](#patterns)
- [Gotchas](#gotchas)

## Scaffold

```sh
npm create moost@latest [name] -- [flags]
```

Flags (from `create-moost/src/index.ts`):
- `--http` — HTTP server with `@moostjs/event-http`
- `--cli` — CLI with `@moostjs/event-cli`
- `--ws` — WebSocket with `@moostjs/event-ws`
- `--ssr` — Vue SSR/SPA with `@moostjs/vite`
- `--wf` — add `@moostjs/event-wf` workflow adapter (combines with `--http`)
- `--oxc` — oxlint + oxfmt tooling
- `--force` — overwrite existing directory

Combinations (e.g. `--http --ws --wf`) produce one app with all adapters.

## Mental model

- **Controllers** — `@Controller()` classes with handler methods
- **Adapters** — `TMoostAdapter<H>` implementations bridging an event source (HTTP/CLI/WS/WF/…) to handlers
- **Handlers** — methods decorated with `@Get`/`@Cli`/`@Message`/`@Step`/…
- **Pipes** — transform/resolve/validate handler args
- **Interceptors** — cross-cutting before/after/error logic

No module abstraction: controllers register directly on the Moost instance. Moost itself is a controller — decorating methods on a Moost subclass makes them handlers.

## Lifecycle

```
new Moost(opts?)               // logger, globalPrefix
app.adapter(adapter)           // attach (order irrelevant functionally)
app.registerControllers(...)   // classes, instances, or [prefix, ctrl] tuples
await app.init()               // async — bind all handlers, call adapter.onInit()
adapter.listen(3000)           // adapter-specific; may come before or after init()
```

During `init()`:
1. Adapter `getProvideRegistry()` entries merged into DI.
2. Controller methods scanned for handler metadata.
3. `adapter.bindHandler(opts)` called per handler.
4. `@MoostInit` methods run (post-bind, complete overview) — see below.
5. `adapter.onInit(moost)` called last.

## App init (`@MoostInit`)

Run a controller method **once at boot** — after all controllers are bound (complete `getControllersOverview()`) and before adapters serve. For one-time setup that needs the final route table (e.g. derive a controller's actual mounted path, warm a cache, validate config).

```ts
import { Moost, Controller, MoostInit, InjectMoost } from 'moost'

@Controller('auth')
class AuthController {
  @MoostInit({ priority: 0 })            // lower priority runs first; default 0
  init(@InjectMoost() moost: Moost) {    // or constructor-inject Moost
    const overview = moost.getControllersOverview() // COMPLETE here
  }
}
```

| # | Invariant |
|---|---|
| 1 | Runs after all `bindHandler` calls, before `adapter.onInit` — `getControllersOverview()` is complete (incl. `handlers[].registeredAs[].path`). A SINGLETON constructor runs *during* bind and sees a PARTIAL overview — use `@MoostInit` instead. |
| 2 | Runs exactly once per `init()`. |
| 3 | SINGLETON controllers only. `@MoostInit` on a `FOR_EVENT` controller throws at bind. |
| 4 | Args resolve via the RESOLVE pipe ONLY — `@InjectMoost`/`@Inject`/`@Resolve`/`@Const` work; TRANSFORM/VALIDATE pipes and interceptors do NOT run. |
| 5 | No event context — request composables (`useRequest`/`useHeaders`/`useRouteParams`/`useCookies`) fail. DI + `app.getLogger()` work. |
| 6 | Ordered by `priority` ascending (default 0) across ALL controllers, then registration order. |
| 7 | Async hooks awaited; a throwing hook rejects `init()` (fail-fast). |

Key imports: `import { MoostInit, InjectMoost } from 'moost'`. `@InjectMoost` injects the running `Moost`; constructor injection of `Moost` also works (it's in the provide registry).

### Resolving a handler's mounted path

Common `@MoostInit` task: get a handler's *actual* composed path (e.g. to scope a cookie). Don't hand-walk `getControllersOverview()` — use the helpers (all return **all distinct** paths as `string[]`):

```ts
import { getHandlerPaths, useHandlerPaths } from 'moost'

@MoostInit() init(@HandlerPaths('refresh') paths: string[]) {}         // param resolver
@MoostInit() async init() { await useHandlerPaths('refresh') }        // composable (current controller)
getHandlerPaths(moost, AuthController, 'refresh')                      // pure fn, anywhere
```

| # | Invariant |
|---|---|
| 1 | Returns ALL distinct mounted paths — a method can resolve to several (multi-prefix `@ImportController`, multiple verbs, multiple `registeredAs`). Don't assume one. |
| 2 | `[]` when nothing matches — check and warn at boot. |
| 3 | `opts.type` filters by event type (`'HTTP'`); `opts.predicate(h)` narrows by transport detail (e.g. HTTP verb `h.handler.method`) without coupling core to a transport. |
| 4 | `@HandlerPaths(method?)`/`useHandlerPaths(method?)` default `method` to the current context method — in `@MoostInit` that's the init method, so pass the handler method name explicitly. |

## API

### `new Moost(opts?: TMoostOptions)`

- `globalPrefix?: string` — prepended to all event paths
- `logger?: TConsoleBase` — defaults to console-backed `ProstoLogger`

### Methods

| Method | Notes |
|---|---|
| `adapter<T>(a: T): T` | attach adapter; returns the adapter |
| `registerControllers(...ctrls)` | classes / instances / `[prefix, ctrl]` tuples |
| `init(): Promise<void>` | must be awaited |
| `applyGlobalInterceptors(...items)` | class ctors, `TInterceptorDef`, or `TInterceptorData` |
| `applyGlobalPipes(...pipes)` | `TPipeFn` or `TPipeData` |
| `setProvideRegistry(reg)` | merges DI providers |
| `setReplaceRegistry(reg)` | DI class replacements |
| `getLogger(topic?)` | scoped logger |
| `getControllersOverview()` | introspection |
| `getGlobalInterceptorHandler()` | for not-found paths in custom adapters |

### `@Controller(prefix?)`

Class decorator. Prepends `prefix` to all handler paths. Auto-sets `@Injectable(true)` (SINGLETON) if not already injectable.

### `@ImportController(ctrl, provide?)` / `@ImportController(prefix, ctrl, provide?)`

Nest a sub-controller; its prefix is appended to the parent's. `ctrl` may be `() => Ctrl` for lazy / circular refs.

```ts
@Controller('api')
@ImportController(UsersController)
@ImportController('v2', UsersControllerV2)
class AppController {}
```

## Patterns

### Extending Moost

```ts
class MyApp extends Moost {
  @Get('hello/:name')
  hello(@Param('name') name: string) { return `Hello, ${name}!` }
}
const app = new MyApp()
app.adapter(new MoostHttp()).listen(3000)
await app.init()
```

### Shared controller across event types

```ts
@Controller('greet')
class GreetController {
  @Get(':name')
  @Cli(':name')
  greet(@Param('name') name: string) { return `Hello, ${name}!` }
}
```

## Gotchas

- `init()` is async — must be awaited. Routes are bound inside.
- `@Controller()` defaults to SINGLETON (not FOR_EVENT). Singleton controllers are instantiated once during `init()` in a synthetic event context — composables reading request data do not work in SINGLETON constructors.
- `adapter()` call order does not affect behavior.
- `registerControllers()` accepts classes OR instances; prefer classes so DI instantiates them.
- Each adapter filters handlers by its own type — adding an adapter doesn't accidentally double-bind.
