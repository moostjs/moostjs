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
- `FOR_EVENT` — fresh instance per event. Requires an active event context. Auto-cleaned when the scope unregisters.

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

| # | Invariant |
|---|---|
| 1 | `@Inject(SomeClass)` matches class-keyed provide entries (the key is normalized to the registry's symbol). It is usually redundant: class-typed constructor params resolve automatically by type, consulting the provide registry. |
| 2 | `@Inject` on handler/`@MoostInit` method params or on properties is a no-op — yields `undefined` regardless of registration (only Infact's constructor path consumes `inject` meta). Use constructor injection or `@Resolve`-based decorators instead. |
| 3 | A missing key on a non-`@Optional()` constructor param throws `Could not inject ...` at instantiation. |

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
  ['API_KEY',     () => process.env.API_KEY],
)
app.setProvideRegistry(provide)

const replace = createReplaceRegistry([AbstractRepo, ConcreteRepo])
app.setReplaceRegistry(replace)
```

Registries merge — later entries override earlier ones with the same key.

## Scoped injection

`defineInfactScope(name, vars)` defines a named scope with variables. `@InjectFromScope(scopeName)` pulls an instance from that scope. `@InjectScopeVars(varName?)` injects **one variable by key** from the *current* scope's vars (no arg = the full vars object) — the argument is a variable name like `'tenantId'`, NOT a scope name. It only resolves on instances created within a registered scope (e.g. via `@InjectFromScope`); otherwise it yields `undefined`.

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
@Injectable('FOR_EVENT')  // REQUIRED for per-event property injection
@LoggerTopic('orders')    // class-level topic for @InjectMoostLogger
@Controller('orders')
class OrderController {
  @InjectEventLogger() logger!: Logger            // per-event (useLogger under the hood)
  @InjectMoostLogger() appLogger!: Logger         // app-level (topic: arg, else @LoggerTopic, else class @Id)
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

### Scoped provide via controller hierarchy

`@Provide` on a parent controller is visible to all `@ImportController` descendants.

### Manual scope (custom adapters)

```ts
const scopeId = useScopeId()
const unscope = registerEventScope(scopeId)
// ... handle event ...
unscope()   // cleans up FOR_EVENT instances
```

### Container utilities

- `getMoostInfact()` — the shared Infact container Moost uses (e.g. `unregisterScope` in workflow adapters)
- `getNewMoostInfact()` — a fresh, isolated container configured for moost metadata (useful in tests)
- `setInfactLoggingOptions({ newInstance?, warn?, error? })` — controls which DI events are logged (`newInstance` accepts `true`/`false`/`'SINGLETON'`/`'FOR_EVENT'`)
- `getInfactScopeVars(scopeName)` — reads the vars object registered with `defineInfactScope` (what `@InjectScopeVars` uses under the hood)

## Gotchas

- `@Injectable()` with no arg = SINGLETON, not FOR_EVENT.
- SINGLETON constructors run in a synthetic context during `init()` — composables reading event data (`useRequest`, etc.) don't work there.
- FOR_EVENT requires an active event context — cannot be instantiated outside one.
- `@Circular` works on params only, not properties.
- Provide registries merge down the `@ImportController` chain; `@Replace` reaches only direct children — `app.setReplaceRegistry()` is the app-wide mechanism.
- The DI container runs pipes when resolving constructor params/properties, so the resolve pipe must be in the pipeline (it is, by default via `sharedPipes`).

## Key imports

```ts
import { Injectable, Inject, Provide, Replace, Circular, Optional,
         InjectFromScope, InjectScopeVars, defineInfactScope,
         InjectEventLogger, InjectMoostLogger, LoggerTopic,
         createProvideRegistry, createReplaceRegistry,
         useScopeId, registerEventScope, getMoostInfact } from 'moost'
```

## See also

- [pipes.md](pipes.md) — the same pipe pipeline resolves constructor params and properties
- [interceptors.md](interceptors.md) — class-based interceptors are DI-instantiated (`@Interceptor(priority, scope)`)
- [core.md](core.md#app-init-moostinit) — boot-time setup with `@MoostInit`
