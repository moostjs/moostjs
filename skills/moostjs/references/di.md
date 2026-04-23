# Dependency Injection — moost

Powered by `@prostojs/infact`. Scopes, providers, replacements, circular refs, logger injection.

- [Scopes](#scopes)
- [Core decorators](#core-decorators)
- [Registries](#registries)
- [Scoped injection](#scoped-injection)
- [Logger decorators](#logger-decorators)
- [Patterns](#patterns)
- [Gotchas](#gotchas)

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

### `@Inject(key)` — param / prop

Resolve by string key or class constructor from the provide registry.

```ts
constructor(
  @Inject('DATABASE_URL') private url: string,
  @Inject(ConfigService) private cfg: ConfigService,
) {}
// property
@Inject('CONFIG') config!: AppConfig
```

### `@Provide(type, factory)` — class / param / prop

Adds a provide entry visible to the class and its `@ImportController` children.

```ts
@Provide('DATABASE_URL', () => process.env.DATABASE_URL)
@Provide(Logger, () => new Logger('app'))
@Controller('api')
class ApiController {}
```

### `@Replace(from, to)` — class

Substitute one class with another in the subtree. Shorthand for `createReplaceRegistry([from, to])` applied to this class.

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

`defineInfactScope(name, vars)` defines a named scope with variables. `@InjectFromScope(name)` pulls an instance from that scope; `@InjectScopeVars(name?)` reads its variables (without name = full vars object).

```ts
defineInfactScope('tenant', { tenantId: 'abc', region: 'us-east' })
class Handler {
  constructor(@InjectFromScope('tenant') private svc: TenantService) {}
}
```

## Logger decorators

```ts
@LoggerTopic('orders')   // class-level default topic for @InjectMoostLogger
class OrderController {
  @InjectEventLogger('orders') logger!: Logger   // per-event (useLogger under the hood)
  @InjectMoostLogger()         appLogger!: Logger // app-level (uses @LoggerTopic or class @Id)
}
```

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

## Gotchas

- `@Injectable()` with no arg = SINGLETON, not FOR_EVENT.
- SINGLETON constructors run in a synthetic context during `init()` — composables reading event data (`useRequest`, etc.) don't work there.
- FOR_EVENT requires an active event context — cannot be instantiated outside one.
- `@Circular` works on params only, not properties.
- Provide registries merge; replace registries apply tree-wide — use sparingly.
- The DI container runs pipes when resolving constructor params/properties, so the resolve pipe must be in the pipeline (it is, by default via `sharedPipes`).
