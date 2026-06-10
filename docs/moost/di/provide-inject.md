# Dependency Substitution

Beyond automatic constructor injection, Moost lets you control how dependencies are provided and replace one class with another — useful for testing, feature toggles, and runtime configuration.

## @Provide

`@Provide` binds a factory function to a class type or string key. The provided instance propagates down the dependency tree — the class itself and every dependency it creates (directly or transitively) will see this instance when they ask for it. A deeper `@Provide` for the same type overrides the parent one for that subtree.

This is what makes `@Provide` different from just calling `new` in a constructor: you're configuring how a dependency resolves for an entire branch of the object graph, not just one consumer.

**Class-based** — provide a specific instance for the entire subtree:

```ts
import { Provide, Controller } from 'moost'

@Provide(Logger, () => new Logger('api'))
@Controller('api')
class ApiController {
  // ApiController, its dependencies, and their dependencies
  // all receive this Logger instance when they inject Logger
  constructor(private userService: UserService) {}
}
```

Here `UserService` and anything `UserService` depends on will all get the `Logger('api')` instance — without any of them knowing about the provide. A different controller could provide `Logger('admin')` and its subtree would get that one instead.

**String key** — differentiate multiple instances of the same type:

```ts
@Controller()
@Provide('primary-db', () => new Database(primaryConfig))
@Provide('analytics-db', () => new Database(analyticsConfig))
class ReportController {
  constructor(
    @Inject('primary-db') private primary: Database,
    @Inject('analytics-db') private analytics: Database,
  ) {}
}
```

## @Inject

Explicitly specify which provide entry to inject — by string key or by class:

```ts
import { Inject, Controller } from 'moost'

@Controller()
class MyController {
  constructor(
    @Inject('cache-store') private cache: CacheStore,
    @Inject(EmailService) private email: EmailService,
  ) {}
}
```

Use `@Inject` when the constructor parameter type alone isn't enough to identify the dependency. For class-keyed provides `@Inject` is optional: declaring the parameter with the class type (`private email: EmailService`) picks up the matching `@Provide(EmailService, ...)` entry automatically, and `@Inject(EmailService)` makes the same lookup explicit.

## Global Provide Registry

Instead of scattering `@Provide` across classes, centralize dependency definitions on the app instance:

```ts
import { createProvideRegistry } from 'moost'

app.setProvideRegistry(createProvideRegistry(
  [DatabaseConnection, () => new DatabaseConnection(config)],
  ['cache-store', () => new RedisCache()],
))
```

This keeps configuration in one place, making it easier to swap implementations across the whole app.

## @Replace

Override one class with another, so injection points expecting the original class receive the replacement instead.

**Via registry (global):**

```ts
import { createReplaceRegistry } from 'moost'

app.setReplaceRegistry(createReplaceRegistry(
  [EmailService, MockEmailService],
  [PaymentGateway, TestPaymentGateway],
))
```

Every injection point in the app expecting `EmailService` now resolves to `MockEmailService`. This is the mechanism to reach for in tests and feature toggles.

**Via decorator (scoped to imported sub-controllers):**

```ts
import { Replace, Controller, ImportController } from 'moost'

@Controller()
@Replace(EmailService, MockEmailService)
@ImportController(UsersController)
class TestController {
  // EmailService injections inside UsersController (and its own imports)
  // resolve to MockEmailService
}
```

::: warning
The `@Replace` decorator does **not** redirect the decorated class's own constructor injections — the replacement registry it declares only applies to controllers imported from it via `@ImportController`. To replace a class app-wide, use `app.setReplaceRegistry()` (or decorate your custom `Moost` app subclass).
:::

This is especially useful for:
- **Testing** — inject mocks without changing consumer code
- **Feature toggles** — swap implementations at startup
- **Third-party controllers** — override dependencies you can't modify directly

## Custom Scopes

Beyond the built-in `SINGLETON` and `FOR_EVENT` scopes, you can define custom named scopes with associated variables using `defineInfactScope`. Classes injected via `@InjectFromScope` are instantiated within that scope, and `@InjectScopeVars` lets them access the scope's variables.

### Defining a Scope

Register a named scope with its variables before the app starts:

```ts
import { defineInfactScope } from 'moost'

defineInfactScope('tenant', {
  tenantId: 'acme',
  region: 'eu-west-1',
})
```

You can read a scope's vars programmatically with `getInfactScopeVars('tenant')` (also exported from `moost`).

### @InjectFromScope

Marks a constructor parameter or property so that the injected class is instantiated **within the named scope**:

```ts
import { Injectable, InjectFromScope } from 'moost'

@Injectable()
class TenantConfig {
  constructor(/* resolved within the 'tenant' scope */) {}
}

@Controller()
class BillingController {
  constructor(@InjectFromScope('tenant') private config: TenantConfig) {}
}
```

### @InjectScopeVars

Resolves scope variables for classes living inside a custom scope. Use it inside classes that are instantiated via `@InjectFromScope`:

```ts
import { Injectable, InjectScopeVars } from 'moost'

@Injectable()
class TenantService {
  constructor(
    // inject a single variable by name
    @InjectScopeVars('tenantId') private tenantId: string,
  ) {}
}
```

Omit the name to receive the entire scope variables object:

```ts
@Injectable()
class TenantService {
  constructor(
    @InjectScopeVars() private vars: { tenantId: string; region: string },
  ) {}
}
```

## Gotchas

- **`@Provide`/`@Inject` don't make a class injectable.** The class still needs `@Controller()` or `@Injectable()` — otherwise the DI container rejects it with `Class is not Injectable and not Optional`.
- **A missing provide entry throws at instantiation.** If `@Inject('key')` has no matching entry anywhere up the tree, instance creation fails (unless the parameter is marked `@Optional()`).
- **Provide factories run once per registry entry.** The result is cached and shared by every consumer in the subtree — a factory is *not* called once per consumer.
- **Register custom scopes before they are used.** `@InjectFromScope('name')` throws if `defineInfactScope('name', ...)` was not called first.
