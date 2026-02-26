# Interceptors in Moost

Interceptors hook into the event lifecycle to run logic before and after your handlers. They handle cross-cutting concerns — authentication, logging, error handling, response transformation — without cluttering controller code.

## Key Concepts

- **Lifecycle Hooks:** Interceptors run at defined points:
  - **Before:** Runs before the handler. Can short-circuit execution via `reply(value)`.
  - **After:** Runs after successful handler execution. Can transform the response.
  - **Error:** Runs when the handler throws. Can recover with a replacement response.

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

const errorFormatter = defineErrorInterceptor((error, reply) => {
  reply({
    error: error.message,
    code: error.statusCode || 500,
  })
}, TInterceptorPriority.CATCH_ERROR)
```

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

## Class-Based Interceptors

When you need dependency injection, define interceptors as classes using the `@Interceptor` decorator with `@Before`, `@After`, and `@OnError` method decorators.

### Basic example

```ts
import { Interceptor, Before, TInterceptorPriority } from 'moost'

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
- **`@Response()`** — injects the handler result (in `@After`) or the error (in `@OnError`).

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

### DI scopes

By default, `@Interceptor` makes the class injectable as a singleton. Pass a scope to change this:

```ts
@Interceptor(TInterceptorPriority.INTERCEPTOR, 'FOR_EVENT')
class RequestScopedInterceptor {
  // New instance per event — can inject request-scoped dependencies
}
```

## Applying Interceptors

### Per handler

```ts
import { Intercept, Controller } from 'moost'

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
    logger.log(`${method} ${url} OK`)
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
import { useResponse } from '@wooksjs/event-http'

export const errorHandler = defineErrorInterceptor((error, reply) => {
  const response = useResponse()
  const status = error.statusCode || 500
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
