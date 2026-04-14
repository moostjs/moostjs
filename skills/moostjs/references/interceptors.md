# Interceptors — moost

> Priority levels, lifecycle phases (before/after/onError), functional and class-based interceptors, and patterns for guards, response wrappers, and error handlers.

## Concepts

Interceptors wrap handler execution with cross-cutting logic. They follow an onion model: outer interceptors wrap inner ones, and the handler executes at the center.

Two APIs:
- **Functional** — `TInterceptorDef` objects with `before`/`after`/`error` callbacks
- **Class-based** — Classes decorated with `@Interceptor()` using `@Before()`, `@After()`, `@OnError()` method decorators

### Priority Levels

| Priority        | Value | Use Case                           |
| --------------- | ----- | ---------------------------------- |
| `BEFORE_ALL`    | 0     | Outermost wrappers (telemetry)     |
| `BEFORE_GUARD`  | 1     | Pre-guard logic                    |
| `GUARD`         | 2     | Auth/authorization guards          |
| `AFTER_GUARD`   | 3     | Post-guard logic                   |
| `INTERCEPTOR`   | 4     | General-purpose (default)          |
| `CATCH_ERROR`   | 5     | Error catchers/formatters          |
| `AFTER_ALL`     | 6     | Innermost wrappers (cleanup)       |

Lower values run first in the `before` phase. `after` and `onError` use LIFO ordering (inner interceptors run first, closest to the handler).

### Lifecycle Phases

```
before (can short-circuit with reply) →
  argument resolution →
    handler execution →
  after (can transform response) / onError (can recover)
```

1. **before** — Runs before argument resolution and handler. Call `reply(value)` to short-circuit.
2. **after** — Runs after successful handler execution. Receives the response. Call `reply(value)` to replace it.
3. **onError** — Runs when handler throws or returns an Error. Call `reply(value)` to recover.

## API Reference

### @Intercept(handler, priority?, name?)

Attach an interceptor to a class or method. Accepts a class constructor or `TInterceptorDef`.

```ts
import { Intercept, TInterceptorPriority } from 'moost'

@Intercept(AuthGuard, TInterceptorPriority.GUARD)
@Controller('api')
class ApiController {}

// Method-level
class UserController {
  @Intercept(rateLimiter)
  @Get('search')
  search() { /* ... */ }
}
```

### TInterceptorDef (Functional)

Object-based interceptor definition:

```ts
import type { TInterceptorDef } from 'moost'

const myInterceptor: TInterceptorDef = {
  before(reply) {
    // run before handler
    // call reply(value) to short-circuit
  },
  after(response, reply) {
    // run after successful handler
    // call reply(value) to replace response
  },
  error(error, reply) {
    // run on handler error
    // call reply(value) to recover
  },
  priority: TInterceptorPriority.INTERCEPTOR,
  _name: 'myInterceptor',
}
```

### Helper Factories

```ts
import {
  defineBeforeInterceptor,
  defineAfterInterceptor,
  defineErrorInterceptor,
  defineInterceptor,
} from 'moost'

// Single-phase helpers
const guard = defineBeforeInterceptor(
  (reply) => { /* ... */ },
  TInterceptorPriority.GUARD,
)

const transform = defineAfterInterceptor(
  (response, reply) => { /* ... */ },
  TInterceptorPriority.AFTER_ALL,
)

const catcher = defineErrorInterceptor(
  (error, reply) => { /* ... */ },
  TInterceptorPriority.CATCH_ERROR,
)

// Multi-phase
const full = defineInterceptor({
  before(reply) { /* ... */ },
  after(response, reply) { /* ... */ },
}, TInterceptorPriority.INTERCEPTOR)
```

### @Interceptor(priority?, scope?) — Class Decorator

Mark a class as a class-based interceptor. Auto-adds `@Injectable`.

```ts
import { Interceptor, Before, After, OnError, Overtake, Response } from 'moost'

@Interceptor(TInterceptorPriority.GUARD)
class AuthGuard {
  @Before()
  checkAuth(@Overtake() reply: (r: unknown) => void) {
    if (!isAuthenticated()) {
      reply(new HttpError(401, 'Unauthorized'))
    }
  }

  @After()
  addHeaders(@Response() response: unknown) {
    useResponse().setHeader('x-auth', 'verified')
  }

  @OnError()
  handleError(
    @Response() error: Error,
    @Overtake() reply: (r: unknown) => void,
  ) {
    reply({ error: error.message })
  }
}
```

### Method Decorators for Class-Based Interceptors

- `@Before()` — Mark method as before-phase hook
- `@After()` — Mark method as after-phase hook
- `@OnError()` — Mark method as error-phase hook

### Parameter Decorators for Interceptor Methods

- `@Overtake()` — Inject the reply function (`(response) => void`)
- `@Response()` — Inject the handler result (after) or the Error (onError)

### InterceptorHandler

Internal class managing the interceptor lifecycle for a single event. Exposes:

- `count` — Number of registered interceptors
- `countAfter` — Number of after-phase handlers
- `countOnError` — Number of error-phase handlers
- `before()` — Run all before hooks, returns response if short-circuited
- `fireAfter(response)` — Run after or onError hooks based on response type

### useControllerContext() in Interceptors

Access the current controller's runtime context from within a functional interceptor. Essential for reading metadata, instantiating classes through DI, and inspecting the current route.

```ts
import { defineBeforeInterceptor, useControllerContext, TInterceptorPriority } from 'moost'

const metaGuard = defineBeforeInterceptor((reply) => {
  const {
    getController,      // current controller instance
    getMethod,          // handler method name
    getRoute,           // full route path (prefix + handler path)
    getPrefix,          // controller's computed prefix
    getControllerMeta,  // class-level TMoostMetadata
    getMethodMeta,      // method-level TMoostMetadata
    getScope,           // 'SINGLETON' | 'FOR_EVENT' | undefined
    instantiate,        // (Class) => Promise<instance> — DI-resolved
    getParamsMeta,      // handler parameter metadata array
    getPropMeta,        // (name) => property metadata
    getPropertiesList,  // all decorated properties
  } = useControllerContext()

  const meta = getMethodMeta()
  if (meta?.label === 'admin-only') {
    // read custom metadata set via @Label('admin-only')
    // ... check admin permission
  }
}, TInterceptorPriority.GUARD)
```

`instantiate(Class)` creates instances through the DI container, respecting scopes and provide/replace registries. Use it when you need a service not in the controller's constructor.

## Common Patterns

### Auth Guard

```ts
const authGuard = defineBeforeInterceptor((reply) => {
  const { authorization } = useHeaders()
  if (!authorization) {
    reply(new HttpError(401, 'Missing authorization'))
  }
}, TInterceptorPriority.GUARD)

@Intercept(authGuard)
@Controller('protected')
class ProtectedController { /* ... */ }
```

### Response Wrapper

```ts
const wrapResponse = defineAfterInterceptor((response, reply) => {
  if (!(response instanceof Error)) {
    reply({ data: response, timestamp: Date.now() })
  }
})
```

### Global Error Handler

```ts
const errorHandler = defineErrorInterceptor((error, reply) => {
  const status = error instanceof HttpError ? error.statusCode : 500
  reply({ error: error.message, status })
}, TInterceptorPriority.CATCH_ERROR)

app.applyGlobalInterceptors(errorHandler)
```

### Class-Based with DI

```ts
@Interceptor(TInterceptorPriority.GUARD, 'FOR_EVENT')
class RoleGuard {
  constructor(private authService: AuthService) {}

  @Before()
  async check(@Overtake() reply: (r: unknown) => void) {
    const user = await this.authService.getCurrentUser()
    if (!user.hasRole('admin')) {
      reply(new HttpError(403))
    }
  }
}
```

### Conditional Interceptor

Apply an interceptor only to specific methods:

```ts
@Controller('items')
class ItemsController {
  @Get()
  list() { /* public */ }

  @Intercept(authGuard)
  @Post()
  create() { /* protected */ }
}
```

## Best Practices

- Use `TInterceptorPriority.GUARD` for auth/authorization interceptors
- Use `TInterceptorPriority.CATCH_ERROR` for error formatters
- Use `TInterceptorPriority.BEFORE_ALL` / `AFTER_ALL` for telemetry/logging
- Prefer functional interceptors (`TInterceptorDef`) for simple cases
- Use class-based interceptors when you need DI or complex state
- Apply guards at the class level; apply transforms at the method level
- Register error handlers globally via `app.applyGlobalInterceptors()`

## Gotchas

- `reply()` in `before` short-circuits — the handler method is never called
- `after` and `onError` callbacks use LIFO ordering (onion model)
- `after` receives the raw response; `onError` receives the Error instance
- If no `onError` handler calls `reply()`, the error is re-thrown
- Class-based interceptors are instantiated via DI — they must be `@Injectable`
- `@Interceptor()` auto-adds `@Injectable` — do not add both
- Global interceptors registered via `applyGlobalInterceptors()` apply to all handlers including not-found handlers
- The `priority` argument on `@Intercept()` overrides the handler's own priority
- Interceptor factories (functions returning `TInterceptorDef`) are called once per event
