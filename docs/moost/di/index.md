# Dependency Injection

Moost provides dependency injection through [`@prostojs/infact`](https://github.com/prostojs/infact). There are no modules, no providers arrays, no `forRoot()` — mark a class `@Injectable()` and Moost manages its lifecycle.

## Injectable Classes

The `@Injectable()` decorator marks a class as managed by Moost's DI system. Once marked, Moost creates and provides instances automatically when they appear as constructor parameters.

```ts
import { Injectable } from 'moost'

@Injectable()
class UserService {
  findById(id: string) { /* ... */ }
}
```

By default, injectable classes are **singletons** — a single instance shared for the entire app lifetime.

## Scopes

Moost supports two scopes:

| Scope | Behavior |
|-------|----------|
| `SINGLETON` (default) | One instance for the entire app |
| `FOR_EVENT` | Fresh instance per event (HTTP request, CLI command, etc.) |

```ts
@Injectable('FOR_EVENT')
class RequestState {
  // new instance for each event
}
```

::: warning Scope Rule
Do not inject `FOR_EVENT` classes into singletons. Singletons are created once, so an event-scoped dependency inside one would break event isolation. The reverse — injecting singletons into `FOR_EVENT` classes — is fine.
:::

## Controllers and DI

Controllers are automatically injectable (the `@Controller()` decorator handles this). Add constructor parameters typed as injectable classes and Moost resolves them:

```ts
import { Controller } from 'moost'

@Controller()
class UserController {
  constructor(private users: UserService) {}
}
```

To make a controller event-scoped, add `@Injectable('FOR_EVENT')`:

```ts
@Injectable('FOR_EVENT')
@Controller()
class SessionController {
  constructor(private state: RequestState) {}
}
```

## Integration with Pipes

When a constructor parameter or property has metadata (e.g., `@Param()`, `@Resolve()`), the [pipes pipeline](/moost/pipes/) processes the value before injection — resolving, transforming, and validating it.
