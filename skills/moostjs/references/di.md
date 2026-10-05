# Dependency Injection — moost

Powered by `@prostojs/infact`. Scopes, providers, replacements, circular refs, logger injection.

- [Scopes](#scopes)
- [Core decorators](#core-decorators)
- [Registries](#registries)
- [Scoped injection](#scoped-injection)
- [Logger decorators](#logger-decorators)
- [Patterns](#patterns)
- [Gotchas](#gotchas)
- [Key imports](#key-imports)
- [See also](#see-also)

## Scopes

- `SINGLETON` / `true` — one instance for app lifetime. Instantiated once during `init()` (in a synthetic event context) or on first use.
- `FOR_EVENT` — fresh instance per event. Requires an active event context. Auto-cleaned when the event's scope is released.

| #   | `FOR_EVENT` scope lifetime (since 0.6.42)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | HTTP: lives until the response is done (sent, streamed body included, or client disconnected) **and** the handler settled — resolvable after `@Body()`, while a returned stream is sent, and after a client abort. `@Upgrade` handlers: until the handler settles.                                                                                                                                                                                                                                                                                                                                                   |
| 2   | Every event context owns its scope — never inherited from a parent context. A workflow run started with `eventContext: current()` gets its own (its steps share it; released when the run ends): `FOR_EVENT` instances are NOT shared with the starting request — carry data via context/composables. Each WS `@Message` gets its own; `@Connect`/`@Disconnect` use the connection's. Resolving `FOR_EVENT` in a child context no moost handler runs in (a raw wooks handler) fails — it no longer borrows the parent's scope; run such code through `withControllerContext()` (shares the scope explicitly, below). |
| 3   | Symptom of the pre-0.6.42 bugs: `The requested scope "__moost_…" isn't registered` / `Failed to instantiate <FOR_EVENT class>`. ≤ 0.6.39 the HTTP scope ended once the request body was read; ≤ 0.6.41 a client disconnect mid-handler dropped it, a workflow run with `eventContext` released the **starting request's** scope when it ended, and concurrent WS messages on one connection shared one scope (the first to finish tore it down for the rest).                                                                                                                                                        |

### Running code as another controller — `withControllerContext` / `forkEventContext` (moost)

```ts
import { forkEventContext, run, useControllerContext, withControllerContext } from 'moost'
const source = await useControllerContext().instantiate(SourceController)
await withControllerContext(source, 'list', () => source.check(ids)) // shares the event's FOR_EVENT scope
await withControllerContext(source, 'list', fn, { shareScope: false }) // own scope, released when fn settles
await run(forkEventContext({ isolate: [useMyState] }), fn) // bare copy-on-write child
```

| #   | Rule                                                                                                                                                                                                                                                               |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | The child is copy-on-write: reads fall through to the calling event, every write (`ctx.set`, controller context, composable state) stays in the child. `isolate` = slots/wooks the child must NOT read through (parent-built composables are bound to the parent). |
| 2   | `shareScope` (default `true`) shares the calling event's `FOR_EVENT` instances. Without it (plain `forkEventContext`) `FOR_EVENT` throws `scope "…" isn't registered`.                                                                                             |
| 3   | Call only inside a running moost handler. Never run a routed handler in a scope-sharing child (it re-registers / releases the scope) — use `MoostHttp.invoke()` ([event-http.md](event-http.md#moosthttp-api)).                                                    |

`@Controller()` implicitly sets `@Injectable(true)` (SINGLETON). Add `@Injectable('FOR_EVENT')` explicitly on controllers that hold per-event state (property-level ref decorators, per-request fields).

## Core decorators

### `@Injectable(scope?)` — class

```ts
@Injectable()            // SINGLETON (default)
@Injectable(true)        // SINGLETON
@Injectable('SINGLETON') // SINGLETON
@Injectable('FOR_EVENT') // per-event
```

### `@Inject(key)` — constructor params only

Resolve a **string key or class** from the provide registry — on **constructor parameters only**.

```ts
constructor(
  @Inject('DATABASE_URL') private url: string,
  private cfg: ConfigService,  // class-typed deps resolve by TYPE — no @Inject needed
) {}
```

| #   | Invariant                                                                                                                                                                                                                                                          |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | `@Inject(SomeClass)` matches class-keyed provide entries (the key is normalized to the registry's key, `getClassKey(SomeClass)`). It is usually redundant: class-typed constructor params resolve automatically by type, consulting the provide registry.          |
| 2   | `@Inject` on handler/`@MoostInit` method params or on properties is a no-op — yields `undefined` regardless of registration (only Infact's constructor path consumes `inject` meta). Use constructor injection or `@Resolve`-based decorators instead.             |
| 3   | A missing key on a non-`@Optional()` constructor param throws `Could not inject ...` at instantiation.                                                                                                                                                             |
| 4   | Subclassing: a decorated subclass with no own constructor inherits the parent's ctor params automatically; an entirely undecorated subclass inherits NOTHING (not injectable). Rules + bind-time warnings: [decorators.md#inheritance](decorators.md#inheritance). |

### `@Provide(type, factory)` — class / param / prop

Adds a provide entry visible to the class and its `@ImportController` children.

```ts
@Provide('DATABASE_URL', () => process.env.DATABASE_URL)
@Provide(Logger, () => new Logger('app'))
@Controller('api')
class ApiController {}
```

### `@Replace(from, to)` — class

Substitute one class with another. Scope is narrow: `@Replace` on a controller applies to its **directly imported** `@ImportController` children (and their DI graphs) — not grandchildren, and not the decorated controller's own constructor. For app-wide or deep-tree replacement use `app.setReplaceRegistry(...)`.

### `@Circular(() => Type)` — param only

Break constructor-parameter cycles by deferring resolution. Not supported on properties.

## Registries

```ts
const provide = createProvideRegistry(
  [ConfigService, () => new ConfigService()],
  ['API_KEY', () => process.env.API_KEY],
)
app.setProvideRegistry(provide)

const replace = createReplaceRegistry([AbstractRepo, ConcreteRepo])
app.setReplaceRegistry(replace)
```

Registries merge — later entries override earlier ones with the same key.

Class keys are by **constructor identity** (`getClassKey(Class)` → a per-class `Symbol(name)`, exported from `moost`): two classes with identical bodies (`const LoggerToken = class {}`, `const UserToken = class {}`) are distinct tokens in provide/replace registries and singleton slots. `≤ 0.6.40` keyed by source text, so identical-source classes (bare `class {}` tokens, abstract token classes after a bundler erased their members) were ONE token — replacing one replaced the other. Diagnose a prod-only startup error `scope "…" isn't registered` / `Failed to instantiate` on a FOR_EVENT class, or a token resolving to an unrelated provider, as that version gap.

`instantiate(MoostHttp | MoostCli | MoostWf | MoostWs)` returns the adapter attached via `app.adapter()` even when it is a subclass, or when the passed class comes from a **second copy** of the adapter package (one-time `[moost] instantiate(X) resolved the attached adapter through its brand …` warning — fix the duplicate install / SSR externalization, other state is split too). `≤ 0.6.42` → `Class is not Injectable` in both cases. Constructor `@Inject(MoostHttp)` is still class-identity keyed.

## Scoped injection

`defineInfactScope(name, vars)` defines a named scope with variables. `@InjectFromScope(scopeName)` pulls an instance from that scope. `@InjectScopeVars(varName?)` injects **one variable by key** from the _current_ scope's vars (no arg = the full vars object) — the argument is a variable name like `'tenantId'`, NOT a scope name. It only resolves on instances created within a registered scope (e.g. via `@InjectFromScope`); otherwise it yields `undefined`.

```ts
defineInfactScope('tenant', { tenantId: 'abc', region: 'us-east' })
class TenantService {
  constructor(@InjectScopeVars('tenantId') private tenantId: string) {}
}
class Handler {
  constructor(@InjectFromScope('tenant') private svc: TenantService) {}
}
```

## Logger decorators

```ts
@Injectable('FOR_EVENT') // REQUIRED for per-event property injection
@LoggerTopic('orders') // class-level topic for @InjectMoostLogger
@Controller('orders')
class OrderController {
  @InjectEventLogger() logger!: Logger // per-event (useLogger under the hood)
  @InjectMoostLogger() appLogger!: Logger // app-level (topic: arg, else @LoggerTopic, else class @Id)
}
```

- Property resolvers run once at DI instantiation — on a SINGLETON class `@InjectEventLogger` captures the boot-context logger, not a per-event one. Mark the class `@Injectable('FOR_EVENT')` (or use `useLogger()` inside the handler).
- The `topic` argument of `@InjectEventLogger(topic?)` is currently a no-op with `@wooksjs/event-core` >= 0.7.16 (moost still checks the removed `.topic` function; topic scoping moved to `createTopic`). Use `useLogger('topic')` for working topic scoping.

## Patterns

### Provider from adapter

```ts
class MyAdapter implements TMoostAdapter<TMeta> {
  name = 'my-adapter'
  getProvideRegistry() {
    return createProvideRegistry([MyEngine, () => this.engine])
  }
}
```

### Replace for tests

```ts
app.setReplaceRegistry(createReplaceRegistry([DatabaseService, MockDatabaseService]))
```

Register a lowest-precedence default with `{ override: false }` (since 0.6.45). It is used only when neither `@Replace` on the `Moost` subclass nor a normal `setReplaceRegistry()` entry exists, regardless of call order:

```ts
app.setReplaceRegistry(createReplaceRegistry([DatabaseService, InMemoryDatabase]), {
  override: false,
})

app.getReplacement(DatabaseService) // effective app-level replacement (defaults included), one hop
app.hasReplacement(DatabaseService) // boolean
app.getReplaceRegistry() // frozen copy, keys are getClassKey(Class)
```

`setProvideRegistry(reg, { override: false })` is the provider equivalent. Per-controller `@Replace` is not app-level and is not reported by the getters.

### Scoped provide via controller hierarchy

`@Provide` on a parent controller is visible to all `@ImportController` descendants.

### Manual scope (custom adapters)

```ts
const scopeId = useScopeId()
const unscope = registerEventScope(scopeId)
// ... handle event ...
unscope() // cleans up FOR_EVENT instances
```

### Container utilities

- `getMoostInfact()` — the shared Infact container Moost uses (e.g. `unregisterScope` in workflow adapters)
- `getNewMoostInfact()` — a fresh, isolated container configured for moost metadata (useful in tests)
- `setInfactLoggingOptions({ newInstance?, warn?, error? })` — controls which DI events are logged (`newInstance` accepts `true`/`false`/`'SINGLETON'`/`'FOR_EVENT'`)
- `getInfactScopeVars(scopeName)` — reads the vars object registered with `defineInfactScope` (what `@InjectScopeVars` uses under the hood)
- `getClassKey(Class)` — the registry key of a class (identity symbol)

## Gotchas

- `@Injectable()` with no arg = SINGLETON, not FOR_EVENT.
- SINGLETON constructors run in a synthetic context during `init()` — composables reading event data (`useRequest`, etc.) don't work there.
- FOR_EVENT requires an active event context — cannot be instantiated outside one.
- `@Circular` works on params only, not properties.
- Provide registries merge down the `@ImportController` chain; `@Replace` reaches only direct children — `app.setReplaceRegistry()` is the app-wide mechanism.
- The DI container runs pipes when resolving constructor params/properties, so the resolve pipe must be in the pipeline (it is, by default via `sharedPipes`).

## Key imports

```ts
import {
  Injectable,
  Inject,
  Provide,
  Replace,
  Circular,
  Optional,
  InjectFromScope,
  InjectScopeVars,
  defineInfactScope,
  InjectEventLogger,
  InjectMoostLogger,
  LoggerTopic,
  createProvideRegistry,
  createReplaceRegistry,
  getClassKey,
  useScopeId,
  registerEventScope,
  getMoostInfact,
} from 'moost'
```

## See also

- [pipes.md](pipes.md) — the same pipe pipeline resolves constructor params and properties
- [interceptors.md](interceptors.md) — class-based interceptors are DI-instantiated (`@Interceptor(priority, scope)`)
- [core.md](core.md#app-init-moostinit) — boot-time setup with `@MoostInit`
