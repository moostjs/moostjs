# Dependency Injection — moost

> DI container powered by `@prostojs/infact`, scoping strategies, provider registration, and injection patterns.

## Concepts

Moost's DI is built on `@prostojs/infact`. It supports two scopes:

- **SINGLETON** — One instance per application. Created during `init()` or on first access.
- **FOR_EVENT** — One instance per event (HTTP request, CLI command, etc.). Cleaned up when the event scope is unregistered.

DI resolution happens automatically during the handler lifecycle — controller instances, interceptors, and injected dependencies are all resolved through the same container.

### Scope Lifecycle

```
app.init()
  → SINGLETON instances created (once)

Event arrives:
  → DI scope registered (useScopeId + registerEventScope)
  → FOR_EVENT instances created on demand
  → Handler executes
  → DI scope unregistered → FOR_EVENT instances released
```

## API Reference

### `@Injectable(scope?: 'SINGLETON' | 'FOR_EVENT' | true)`

Marks a class as DI-managed. `true` is an alias for `'SINGLETON'`.

```ts
@Injectable('SINGLETON')
class DatabaseService {
  constructor() { /* connects once */ }
}

@Injectable('FOR_EVENT')
class RequestContext {
  // Fresh instance per request/event
}
```

### `@Inject(token: string | symbol | Class)`

Explicit injection by token. Use when automatic type-based resolution isn't sufficient.

```ts
@Injectable()
class MyService {
  constructor(@Inject('CONFIG') private config: AppConfig) {}
}
```

### `@Provide(token?, value?)`

Registers a value or factory in the DI container from a controller/class.

```ts
@Controller()
class AppController {
  @Provide('APP_VERSION')
  version = '1.0.0'
}
```

### `@Circular(() => Type)`

Handles circular dependency references by deferring resolution.

```ts
@Injectable()
class ServiceA {
  constructor(@Circular(() => ServiceB) private b: ServiceB) {}
}
```

### `createProvideRegistry(...entries)`

Creates a provider registry for adapter `getProvideRegistry()`.

```ts
import { createProvideRegistry } from 'moost'

const registry = createProvideRegistry(
  [MyClass, () => myInstance],
  ['string-token', () => someValue],
)
```

### `createReplaceRegistry(...entries)`

Creates a replacement registry for overriding existing providers (useful for testing).

```ts
import { createReplaceRegistry } from 'moost'

const replacements = createReplaceRegistry(
  [RealService, () => new MockService()],
)
```

### `getMoostInfact()`

Returns the singleton `Infact` DI container instance. Mainly used internally by adapters.

```ts
import { getMoostInfact } from 'moost'

const infact = getMoostInfact()
infact.registerScope(scopeId)
infact.unregisterScope(scopeId)
```

## Common Patterns

### Pattern: Adapter DI Providers

Adapters expose their services to controllers via `getProvideRegistry()`:

```ts
class MoostHttp implements TMoostAdapter<THttpHandlerMeta> {
  getProvideRegistry() {
    return createProvideRegistry(
      [WooksHttp, () => this.getHttpApp()],
      [HttpServer, () => this.getHttpApp().getServer()],
    )
  }
}
```

### Pattern: Scope Cleanup for Long-lived Events

For events that outlive a handler call, adapters manually manage scope lifecycle:

```ts
const fn = defineMoostEventHandler({
  manualUnscope: true,
  hooks: {
    init: ({ unscope }) => {
      // Defer cleanup to when the event truly ends
      onEventEnd(() => unscope())
    },
  },
})
```

## Best Practices

- Default to `SINGLETON` scope unless instances need per-event state
- Use `FOR_EVENT` for anything that holds request-specific data (user context, auth state)
- Adapters should provide both class tokens and string tokens in `getProvideRegistry()`
- Avoid manual `getMoostInfact()` calls in application code — use decorators instead

## Gotchas

- `SINGLETON` instances are created during `app.init()` inside a synthetic event context — composables may not behave as expected in constructors
- `FOR_EVENT` instances are only available during event processing — injecting them outside an event context will fail
- Circular dependencies require `@Circular(() => Type)` — without it, the container throws at resolution time
- Scope IDs are monotonic integers (not UUIDs) for performance — don't rely on their format
