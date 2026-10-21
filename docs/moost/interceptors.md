# Interceptors in Moost

Interceptors hook into the event lifecycle to run logic before and after your handlers. They handle cross-cutting concerns — authentication, logging, error handling, response transformation — without cluttering controller code.

## Key Concepts

- **Lifecycle Hooks:** Interceptors run at defined points:
  - **Before:** Runs before the handler. Can short-circuit execution via `reply(value)`.
  - **After:** Runs after successful handler execution. Can transform the response.
  - **Error:** Runs when the handler throws (or an earlier after/error hook raised an error). Can recover with a replacement response.

  After and error hooks form one chain — see [The after/error chain](#the-after-error-chain).

::: tip
*Check the [Event Lifecycle Diagram](/moost/event-lifecycle#diagram) to see exactly when interceptors execute.*
:::

- **Priority Levels:**
  Interceptors execute in order based on their priority (`TInterceptorPriority`):

  | Priority | Value | Use case |
  |---|---|---|
  | `BEFORE_ALL` | 0 | Setup, timing, context |
  | `BEFORE_GUARD` | 1 | Pre-auth logic |
  | `GUARD` | 2 | Authentication & authorization |
  | `AFTER_GUARD` | 3 | Post-auth setup |
  | `INTERCEPTOR` | 4 | General purpose (default) |
  | `CATCH_ERROR` | 5 | Error formatting |
  | `AFTER_ALL` | 6 | Cleanup, final headers |

## Functional Interceptors

Use the `define*` helpers to create interceptors as plain objects.

### Before interceptor

Runs before the handler. Call `reply(value)` to skip the handler entirely:

```ts
import { defineBeforeInterceptor, TInterceptorPriority } from 'moost'
import { HttpError } from '@moostjs/event-http'

const authGuard = defineBeforeInterceptor((reply) => {
  if (!isAuthenticated()) {
    reply(new HttpError(401))
  }
}, TInterceptorPriority.GUARD)
```

### After interceptor

Runs after the handler succeeds. Receives the response; call `reply(newValue)` to replace it:

```ts
import { defineAfterInterceptor, TInterceptorPriority } from 'moost'

const wrapper = defineAfterInterceptor((response, reply) => {
  reply({ data: response, timestamp: Date.now() })
}, TInterceptorPriority.AFTER_ALL)
```

### Error interceptor

Runs when the handler throws. Receives the error; call `reply(value)` to recover:

```ts
import { defineErrorInterceptor, TInterceptorPriority } from 'moost'
import { HttpError } from '@moostjs/event-http'

const errorFormatter = defineErrorInterceptor((error, reply) => {
  reply({
    error: error.message,
    code: error instanceof HttpError ? error.body.statusCode : 500,
  })
}, TInterceptorPriority.CATCH_ERROR)
```

Every after and error hook also receives a third argument, `original`: the value that entered the after/error chain (the handler's result or error), before any hook replaced it.

::: warning
The error parameter is typed `Error`. `HttpError` does **not** expose a `statusCode` property on the instance — the status code lives in its `body` getter (`error.body.statusCode`), so narrow with `instanceof HttpError` first.
:::

### Full interceptor

Combine multiple hooks in a single definition:

```ts
import { defineInterceptor, TInterceptorPriority } from 'moost'

const timing = defineInterceptor({
  before() {
    // record start time
  },
  after(response, reply) {
    // log duration, transform response
  },
  error(error, reply) {
    // handle errors
  },
}, TInterceptorPriority.INTERCEPTOR)
```

### Default priorities

Each helper uses a sensible default priority:

| Helper | Default priority |
|---|---|
| `defineBeforeInterceptor` | `INTERCEPTOR` |
| `defineAfterInterceptor` | `AFTER_ALL` |
| `defineErrorInterceptor` | `CATCH_ERROR` |
| `defineInterceptor` | `INTERCEPTOR` |

## The after/error chain

After the handler (or a before hook's `reply()`), the after and error hooks run as **one chain over the current value**, innermost interceptor first (the reverse of the before order):

1. Each hook receives the **current** value: the handler result as replaced by the hooks that ran before it. The value that entered the chain is the third argument (`original`).
2. If the current value is an `Error`, the interceptor's `error` hook runs; otherwise its `after` hook.
3. A hook that **throws**, or calls `reply()` with an `Error`, switches the rest of the chain to error hooks.
4. A `reply()` with a non-Error value recovers the chain: the interceptors after it run their `after` hooks with that value.
5. If the chain ends on a raised error, the error is thrown to the adapter (an error response for HTTP).

```ts
// innermost: turns a missing record into an HttpError
const notFound = defineAfterInterceptor((response, reply) => {
  if (response === null) reply(new HttpError(404))
}, TInterceptorPriority.AFTER_ALL)

// outer: sees the HttpError raised above, and recovers it
const errorFormatter = defineErrorInterceptor((error, reply, original) => {
  reply({ error: error.message, handlerReturned: original })
}, TInterceptorPriority.CATCH_ERROR)
```

Since hooks run in the reverse of the priority order, an error raised by an after hook reaches the error hooks of interceptors with a **lower** priority value (outer), not ones that already ran. A `CATCH_ERROR` interceptor sees errors raised by after hooks at `AFTER_ALL`, which run first — put an after hook that may throw there.

::: warning Changed after 0.6.53 — check interceptors that relied on the old behaviour
Up to and including `0.6.53`, every after/error hook received the original value (a `reply()` did not reach later hooks), the error hooks ran only when the handler failed, and an error thrown in an after hook skipped every error hook. With the chain:

- **An outer error-only hook (a logger, an audit trail) no longer sees an error that an inner hook recovered.** Once a `CATCH_ERROR` hook replies with an error body, the interceptors outside it run their `after` hook with that body, not their `error` hook. A logger that must see every failure should read the third argument, `original` (class-based: `useInterceptOriginal()`), in both hooks:

  ```ts
  const audit = defineInterceptor({
    after(response, reply, original) {
      if (original instanceof Error) logFailure(original) // recovered by an inner interceptor
    },
    error(error) {
      logFailure(error)
    },
  }, TInterceptorPriority.BEFORE_ALL)
  ```

- **An outer `after` envelope now wraps error bodies.** An after hook that wraps responses (`reply({ data: response })`) also wraps the body a `CATCH_ERROR` hook recovered with. Check `original instanceof Error` to skip them.
- **An Error replied by an error hook stays an error.** After the handler throws, `reply(new HttpError(...))` in an error hook is now thrown, as the handler's error was (it used to be returned). HTTP answers the same; CLI and workflow adapters now see a thrown error.
- **A hook that throws anything (even a non-Error) switches to error hooks.**
:::

## Class-Based Interceptors

When you need dependency injection, define interceptors as classes using the `@Interceptor` decorator with `@Before`, `@After`, and `@OnError` method decorators.

### Basic example

```ts
import { Interceptor, Before, TInterceptorPriority } from 'moost'
import { HttpError } from '@moostjs/event-http'

@Interceptor(TInterceptorPriority.GUARD)
class AuthInterceptor {
  constructor(private authService: AuthService) {}

  @Before()
  check() {
    if (!this.authService.isAuthenticated()) {
      throw new HttpError(401)
    }
  }
}
```

Moost creates the interceptor through DI, so `AuthService` is injected automatically.

### Using `@Overtake` and `@Response`

Two parameter decorators let interceptor methods access the reply function and handler result:

- **`@Overtake()`** — injects the reply function. Call it to short-circuit or replace the response.
- **`@Response()`** — injects the current value of the after/error chain: the response (in `@After`) or the error (in `@OnError`), as replaced by the hooks that ran before.

```ts
import {
  Interceptor, Before, After, OnError,
  Overtake, Response, TInterceptorPriority,
} from 'moost'
import type { TOvertakeFn } from 'moost'

@Interceptor(TInterceptorPriority.INTERCEPTOR)
class ResponseTransformer {
  @After()
  transform(@Response() response: unknown, @Overtake() reply: TOvertakeFn) {
    reply({ data: response, timestamp: Date.now() })
  }
}

@Interceptor(TInterceptorPriority.CATCH_ERROR)
class ErrorHandler {
  @OnError()
  handle(@Response() error: Error, @Overtake() reply: TOvertakeFn) {
    reply({ message: error.message })
  }
}
```

::: tip Composable counterparts
Anywhere inside the event scope you can also reach these values without decorators: `useOvertake()` (from `moost`) returns the reply function, `useInterceptResult()` returns the current value of the chain, and `useInterceptOriginal()` the value that entered it (the handler's own result or error).
:::

### DI scopes

By default, `@Interceptor` makes the class injectable as a singleton. Pass a scope to change this:

```ts
@Interceptor(TInterceptorPriority.INTERCEPTOR, 'FOR_EVENT')
class RequestScopedInterceptor {
  // New instance per event — can inject request-scoped dependencies
}
```

A singleton interceptor is resolved through DI once per controller it guards and then reused, so its hooks run without a DI lookup on every event. A `FOR_EVENT` interceptor is created anew for each event. Pipes applied to the interceptor class (`@Pipe(...)` on the class) apply to its own constructor parameters and properties too, not only to its hook method arguments.

## Applying Interceptors

### Per handler

```ts
import { Intercept, Controller } from 'moost'
import { Get } from '@moostjs/event-http'

@Controller()
export class ExampleController {
  @Get('secret')
  @Intercept(authGuard)
  secret() { /* protected */ }

  @Get('public')
  publicRoute() { /* not protected */ }
}
```

### Per controller

All handlers in the controller are intercepted:

```ts
@Intercept(authGuard)
@Controller('admin')
export class AdminController {
  @Get('dashboard')
  dashboard() { /* protected */ }

  @Get('settings')
  settings() { /* also protected */ }
}
```

### Globally

Affects every handler in the application:

```ts
const app = new Moost()
app.applyGlobalInterceptors(timing, errorFormatter)
```

Class-based interceptors work the same way:

```ts
app.applyGlobalInterceptors(AuthInterceptor)
```

## Turning Interceptors into Decorators

Wrap an interceptor with `Intercept` to create a reusable decorator:

```ts
import { Intercept, defineBeforeInterceptor, TInterceptorPriority } from 'moost'
import { HttpError } from '@moostjs/event-http'

const guardFn = defineBeforeInterceptor((reply) => {
  if (!isAuthorized()) {
    throw new HttpError(401)
  }
}, TInterceptorPriority.GUARD)

// Create a decorator
const RequireAuth = Intercept(guardFn)

// Use it
@RequireAuth
@Controller('admin')
export class AdminController { /* ... */ }
```

### Parameterized decorators

Create decorator factories for configurable interceptors:

```ts
const RequireRole = (role: string) => {
  const fn = defineBeforeInterceptor((reply) => {
    if (!hasRole(role)) {
      throw new HttpError(403, `Requires role: ${role}`)
    }
  }, TInterceptorPriority.GUARD)
  return Intercept(fn)
}

@RequireRole('admin')
@Controller('admin')
export class AdminController { /* ... */ }
```

## Practical Examples

### Request logger

```ts
import { defineInterceptor, TInterceptorPriority } from 'moost'
import { useRequest } from '@wooksjs/event-http'
import { useLogger } from '@wooksjs/event-core'

export const requestLogger = defineInterceptor({
  after() {
    const { url, method } = useRequest()
    const logger = useLogger('http')
    logger.info(`${method} ${url} OK`)
  },
  error(error) {
    const { url, method } = useRequest()
    const logger = useLogger('http')
    logger.error(`${method} ${url} FAILED: ${error.message}`)
  },
}, TInterceptorPriority.BEFORE_ALL)
```

### Error handler

```ts
import { defineErrorInterceptor, TInterceptorPriority } from 'moost'
import { useResponse, HttpError } from '@wooksjs/event-http'

export const errorHandler = defineErrorInterceptor((error, reply) => {
  const response = useResponse()
  const status = error instanceof HttpError ? error.body.statusCode : 500
  response.status = status
  reply({
    error: error.message,
    statusCode: status,
  })
}, TInterceptorPriority.CATCH_ERROR)
```

### Timing interceptor (class-based)

```ts
import { Interceptor, Before, After, TInterceptorPriority } from 'moost'

@Interceptor(TInterceptorPriority.BEFORE_ALL, 'FOR_EVENT')
class TimingInterceptor {
  private start = 0

  @Before()
  recordStart() {
    this.start = performance.now()
  }

  @After()
  logDuration() {
    const ms = (performance.now() - this.start).toFixed(1)
    console.log(`Request completed in ${ms}ms`)
  }
}
```

## Best Practices

- **Keep interceptors focused:** Each interceptor should handle a single concern (auth, logging, formatting). This keeps them composable and testable.
- **Use the right priority:** Assign meaningful priorities so interceptors execute in a logical order — auth before business logic, cleanup after everything else.
- **Prefer functional for simple cases:** `defineBeforeInterceptor` / `defineAfterInterceptor` are lighter than class-based interceptors and easier to compose.
- **Use class-based for DI:** When you need injected services, use `@Interceptor` with method decorators.
