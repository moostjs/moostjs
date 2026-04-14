# Dependency Injection — moost

> SINGLETON vs FOR_EVENT scopes, injectable classes, provide/inject/replace registries, circular dependencies, and DI container integration.

## Concepts

Moost DI is powered by `@prostojs/infact`, a lightweight dependency injection container. Key concepts:

1. **Scopes** — `SINGLETON` (one instance per app) or `FOR_EVENT` (one instance per event/request)
2. **Provide registries** — Map class constructors or string keys to factory functions
3. **Replace registries** — Substitute one class with another throughout the DI tree
4. **Auto-wiring** — Constructor parameters and properties are resolved via pipes and metadata

The DI container resolves dependencies by reading `@prostojs/mate` metadata (type info, inject keys, circular refs) and running the pipe pipeline for each parameter and property.

## API Reference

### @Injectable(scope?)

Mark a class for dependency injection.

```ts
import { Injectable } from 'moost'

@Injectable()           // SINGLETON (default)
@Injectable(true)       // SINGLETON
@Injectable('SINGLETON') // explicit SINGLETON
@Injectable('FOR_EVENT') // new instance per event
class MyService {}
```

Scope behavior:
- `SINGLETON` / `true` — Single instance shared across all events. Created once during init or first use.
- `FOR_EVENT` — New instance created for each incoming event. Automatically cleaned up when the event scope ends.

### @Inject(key)

Inject a value from the provide registry by string key or class constructor.

```ts
class MyController {
  constructor(
    @Inject('DATABASE_URL') private dbUrl: string,
    @Inject(ConfigService) private config: ConfigService,
  ) {}
}
```

### @Provide(type, factory)

Define a provide entry on a class. The factory is available to the class and all its nested controllers/children.

```ts
@Provide('DATABASE_URL', () => process.env.DATABASE_URL)
@Provide(Logger, () => new Logger('app'))
@Controller('api')
class ApiController {}
```

### @Circular(() => Type)

Break circular dependency references by deferring resolution.

```ts
class ServiceA {
  constructor(@Circular(() => ServiceB) private b: ServiceB) {}
}

class ServiceB {
  constructor(@Circular(() => ServiceA) private a: ServiceA) {}
}
```

### createProvideRegistry(...entries)

Create a provide registry from `[key, factory]` pairs.

```ts
import { createProvideRegistry } from 'moost'

const registry = createProvideRegistry(
  [ConfigService, () => new ConfigService()],
  ['API_KEY', () => process.env.API_KEY],
)
app.setProvideRegistry(registry)
```

### createReplaceRegistry(...entries)

Create a replace registry from `[original, replacement]` pairs.

```ts
import { createReplaceRegistry } from 'moost'

const registry = createReplaceRegistry(
  [AbstractRepo, ConcreteRepo],
)
app.setReplaceRegistry(registry)
```

### getMoostInfact()

Return the shared Infact DI container instance. Rarely needed directly — use decorators instead.

```ts
import { getMoostInfact } from 'moost'

const infact = getMoostInfact()
// Register a scope manually
infact.registerScope('my-scope')
// Unregister when done
infact.unregisterScope('my-scope')
```

### @InjectFromScope(name)

Inject an instance from a named scope defined by `defineInfactScope()`.

```ts
import { InjectFromScope } from 'moost'

class MyHandler {
  constructor(@InjectFromScope('tenant') private tenantService: TenantService) {}
}
```

### @InjectScopeVars(name?)

Inject scope variables defined by `defineInfactScope()`. Without a name argument, returns the full vars object.

### defineInfactScope(name, vars)

Define a named scope with key-value variables.

```ts
import { defineInfactScope } from 'moost'

defineInfactScope('tenant', { tenantId: 'abc', region: 'us-east' })
```

### @Replace(originalClass, replacementClass)

Class decorator. Substitute one class with another in the DI tree. The replacement class must be compatible with the original.

```ts
import { Replace } from 'moost'

@Replace(AbstractRepo, ConcreteRepo)
@Controller('api')
class ApiController {}
```

Internally uses `createReplaceRegistry`. Equivalent to calling `app.setReplaceRegistry(createReplaceRegistry([AbstractRepo, ConcreteRepo]))` but scoped to the controller hierarchy.

### Logger Decorators

Inject loggers via decorators instead of composables:

```ts
import { InjectEventLogger, InjectMoostLogger, LoggerTopic } from 'moost'
import type { Logger } from 'moost'

@LoggerTopic('orders')  // sets default topic for @InjectMoostLogger
@Controller('orders')
class OrderController {
  @InjectEventLogger('orders')  // scoped to the current event context
  logger!: Logger

  @InjectMoostLogger()          // app-level logger (uses @LoggerTopic or class ID as topic)
  appLogger!: Logger

  @Get(':id')
  find(@Param('id') id: string) {
    this.logger.info(`Finding order ${id}`)  // per-request logger
    return findOrder(id)
  }
}
```

- `@InjectEventLogger(topic?)` — Resolves via `useLogger()` from the event context. Scoped to the current request/command/message.
- `@InjectMoostLogger(topic?)` — Resolves the app-level logger from the Moost instance. Uses `@LoggerTopic` value or the class `@Id` as fallback topic.
- `@LoggerTopic(topic)` — Class/param/property decorator that sets the logger topic in metadata.

## Common Patterns

### Adapter DI Providers

Adapters expose services to the DI container via `getProvideRegistry()`:

```ts
class MyAdapter implements TMoostAdapter<TMyHandlerMeta> {
  name = 'my-adapter'

  getProvideRegistry() {
    return createProvideRegistry(
      [MyAdapterService, () => this.service],
      ['ADAPTER_CONFIG', () => this.config],
    )
  }

  // ...
}
```

### Scope Cleanup

FOR_EVENT scoped instances are automatically cleaned up when the event scope is unregistered. For manual scope management (e.g., in custom adapters), use `registerEventScope()`:

```ts
import { useScopeId, registerEventScope } from 'moost'

const scopeId = useScopeId()
const unscope = registerEventScope(scopeId)
// ... handle event ...
unscope() // clean up FOR_EVENT instances
```

### Property Injection

Properties decorated with `@Inject` are resolved after construction:

```ts
@Injectable()
class MyService {
  @Inject('CONFIG')
  config!: AppConfig

  @Inject(Logger)
  logger!: Logger
}
```

### Replacing Services in Tests

Use replace registries to swap implementations:

```ts
const app = new Moost()
app.setReplaceRegistry(createReplaceRegistry(
  [DatabaseService, MockDatabaseService],
))
```

### Providing via Controller Hierarchy

`@Provide` on a parent controller makes the value available to all `@ImportController` children:

```ts
@Provide(DbConnection, () => createConnection('main'))
@Controller('api')
@ImportController(UsersController)
@ImportController(OrdersController)
class ApiController {}
```

## Best Practices

- Prefer `SINGLETON` scope unless the service needs per-request state
- Use `@Inject(key)` for string-keyed providers (config values, tokens)
- Use constructor injection for type-safe class dependencies
- Use `@Circular(() => Type)` only when genuinely needed — restructure to avoid cycles when possible
- Use `createProvideRegistry()` at the app level for cross-cutting concerns
- Use `@Provide()` on controllers for scoped/hierarchical configuration

## Gotchas

- `@Controller` auto-sets `@Injectable` — do not add both decorators
- `@Injectable()` with no argument defaults to `SINGLETON`, not `FOR_EVENT`
- `FOR_EVENT` instances require an active event context — they cannot be created outside of event processing
- Singleton controllers are instantiated in a synthetic event context during `init()`, so composables that read event data will not work in constructors
- The DI container runs pipes for constructor parameters — the resolve pipe must be in the pipeline for `@Inject` to work
- `@Circular` only works on constructor parameters, not properties
- Provide registries merge (later entries override earlier ones with the same key)
- Replace registries affect the entire DI tree — use sparingly
