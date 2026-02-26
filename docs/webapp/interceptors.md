# Interceptors

Interceptors hook into the request lifecycle to run logic before and after your handlers. They're the foundation for authentication, logging, error handling, and response transformation.

## Lifecycle

Every request passes through interceptors in this order:

1. **Before hooks** — run before the handler (can reply early)
2. **Handler execution** — your route handler runs
3. **After hooks** — run after the handler (can transform the response)
4. **Error hooks** — run if an error is thrown at any point

::: tip
See the [Event Lifecycle Diagram](/moost/event-lifecycle#diagram) for the full picture of how interceptors fit into the request flow.
:::

## Writing functional interceptors

### Before interceptor

Use `defineBeforeInterceptor` to run logic before the handler. Call `reply(value)` to skip the handler and respond immediately:

```ts
import { defineBeforeInterceptor, TInterceptorPriority } from 'moost'

const cacheInterceptor = defineBeforeInterceptor((reply) => {
    const cached = cache.get(currentUrl())
    if (cached) {
        reply(cached) // skip handler, respond with cached value
    }
}, TInterceptorPriority.INTERCEPTOR)
```

### After interceptor

Use `defineAfterInterceptor` to run logic after the handler succeeds. Receives the handler's response; call `reply(newValue)` to replace it:

```ts
import { defineAfterInterceptor, TInterceptorPriority } from 'moost'

const wrapper = defineAfterInterceptor((response, reply) => {
    reply({ data: response, timestamp: Date.now() })
}, TInterceptorPriority.AFTER_ALL)
```

### Error interceptor

Use `defineErrorInterceptor` to handle errors. Receives the thrown error; call `reply(value)` to send a custom error response:

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

Combine multiple hooks in a single definition with `defineInterceptor`:

```ts
import { defineInterceptor, TInterceptorPriority } from 'moost'
import { useRequest } from '@wooksjs/event-http'
import { useLogger } from '@wooksjs/event-core'

const requestLogger = defineInterceptor({
    after() {
        const { url, method } = useRequest()
        useLogger('http').log(`${method} ${url} OK`)
    },
    error(error) {
        const { url, method } = useRequest()
        useLogger('http').error(`${method} ${url} FAILED: ${error.message}`)
    },
}, TInterceptorPriority.BEFORE_ALL)
```

## Priority levels

Interceptors run in priority order, lowest first:

| Priority | Value | Use case |
|---|---|---|
| `BEFORE_ALL` | 0 | Setup, timing, context |
| `BEFORE_GUARD` | 1 | Pre-auth logic |
| `GUARD` | 2 | Authentication & authorization |
| `AFTER_GUARD` | 3 | Post-auth setup |
| `INTERCEPTOR` | 4 | General purpose (default) |
| `CATCH_ERROR` | 5 | Error formatting |
| `AFTER_ALL` | 6 | Cleanup, final headers |

Each helper uses a sensible default:

| Helper | Default priority |
|---|---|
| `defineBeforeInterceptor` | `INTERCEPTOR` |
| `defineAfterInterceptor` | `AFTER_ALL` |
| `defineErrorInterceptor` | `CATCH_ERROR` |
| `defineInterceptor` | `INTERCEPTOR` |

## Applying interceptors

### Per handler

```ts
import { Intercept } from 'moost'

@Controller()
export class ExampleController {
    @Get('secret')
    @Intercept(guard)
    secret() { /* protected */ }

    @Get('public')
    publicRoute() { /* not protected */ }
}
```

### Per controller

All handlers in the controller are intercepted:

```ts
@Intercept(guard)
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

## Turning interceptors into decorators

For cleaner syntax, wrap an interceptor with `Intercept` to create a reusable decorator:

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

## Class-based interceptors

When you need dependency injection in your interceptor, use a class with the `@Interceptor` decorator:

```ts
import {
    Interceptor, Before, After, OnError,
    Overtake, Response, TInterceptorPriority,
} from 'moost'
import type { TOvertakeFn } from 'moost'

@Interceptor(TInterceptorPriority.GUARD)
export class AuthInterceptor {
    constructor(private authService: AuthService) {}

    @Before()
    check() {
        if (!this.authService.isAuthenticated()) {
            throw new HttpError(401)
        }
    }
}
```

Use `@Overtake()` and `@Response()` parameter decorators to access the reply function and handler result:

```ts
@Interceptor(TInterceptorPriority.CATCH_ERROR)
export class ErrorHandler {
    @OnError()
    handle(@Response() error: Error, @Overtake() reply: TOvertakeFn) {
        reply({ message: error.message })
    }
}
```

Apply class-based interceptors the same way:

```ts
@Intercept(AuthInterceptor)
@Controller()
export class ProtectedController { /* ... */ }

// or globally
app.applyGlobalInterceptors(AuthInterceptor)
```

Moost creates the interceptor class through DI, so constructor dependencies are injected automatically.

## Practical example: request logger

```ts
import { Interceptor, After, OnError, TInterceptorPriority } from 'moost'
import { useRequest } from '@wooksjs/event-http'
import { useLogger } from '@wooksjs/event-core'

@Interceptor(TInterceptorPriority.BEFORE_ALL)
export class RequestLogger {
    @After()
    logSuccess() {
        const { url, method } = useRequest()
        useLogger('http').log(`${method} ${url} OK`)
    }

    @OnError()
    logError(@Response() error: Error) {
        const { url, method } = useRequest()
        useLogger('http').error(`${method} ${url} FAILED: ${error.message}`)
    }
}
```

## Practical example: error handler

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
