# Dependency Injection

Moost provides dependency injection through [`@prostojs/infact`](https://github.com/prostojs/infact). There are no modules, no providers arrays, no `forRoot()` — mark a class `@Injectable()` and Moost manages its lifecycle. (Advanced users can access the shared Infact container directly via `getMoostInfact()` from `moost`.)

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

Moost has two built-in scopes (custom named scopes are covered in [Dependency Substitution](/moost/di/provide-inject#custom-scopes)):

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

Every event owns its scope. A child event — a workflow run started with `eventContext: current()`, each WebSocket message — gets a scope of its own: `FOR_EVENT` instances are never shared with the parent event, and the child ending never releases the parent's scope (before 0.6.42 it did, failing later resolutions with `scope "…" isn't registered`). How long an HTTP request's scope lives: [Web app DI](/webapp/di).

::: warning Scope Rule
Do not inject `FOR_EVENT` classes into singletons. Singletons are created once, so an event-scoped dependency inside one would break event isolation. The reverse — injecting singletons into `FOR_EVENT` classes — is fine.
:::

## Running Code as Another Controller

`withControllerContext(instance, method, fn, opts?)` runs `fn` in a child of the current event whose controller context is `instance` / `method`. Hooks and services that read `useControllerContext()` (permission layers, metadata readers) then behave as if the event had been routed to that controller — and nothing written in the child (controller context, `ctx.set()`, composable state) leaks back into the calling event.

```ts
import { useControllerContext, withControllerContext } from 'moost'

const source = await useControllerContext().instantiate(IssueController)
const verdicts = await withControllerContext(source, 'list', () => source.checkAccess(ids))
```

| Option | Default | Effect |
| --- | --- | --- |
| `shareScope` | `true` | `FOR_EVENT` dependencies resolve in the calling event's scope (same instances). `false`: the child gets its own scope, registered while `fn` runs and released when it settles |
| `isolate` | — | Slots / `defineWook` composables the child computes for itself instead of reading the caller's |
| `route`, `prefix` | `''`, — | What `useControllerContext().getRoute()` / `getPrefix()` report in the child |

The lower-level `forkEventContext({ isolate? })` creates the same copy-on-write child without a controller context; run code in it with `run(child, fn)`. `FOR_EVENT` classes cannot be resolved in a plain forked context — use `withControllerContext()` for that.

-   **DO** call it from inside a running moost handler (the shared scope must be live).
-   **DON'T** run a routed handler inside a scope-sharing child: a handler registers and releases its own scope. Use [`MoostHttp.invoke()`](/webapp/fetch#http-invoke-method-path-opts-inside-the-current-request) to run another route.

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

## In This Section

- [Dependency Substitution](/moost/di/provide-inject) — `@Provide`/`@Inject`, global provide/replace registries, `@Replace`, and custom named scopes
- [Circular Dependencies](/moost/di/circular) — breaking dependency cycles with `@Circular(() => Type)`
- [Functional Instantiation](/moost/di/functional) — creating DI-resolved instances on demand with `useControllerContext().instantiate()`
