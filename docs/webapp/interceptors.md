# Interceptors

Interceptors hook into the request lifecycle to run logic before and after your handlers. They're the foundation for authentication, logging, error handling, and response transformation.

## Lifecycle

Every request passes through interceptors in this order:

1. **Init phase** — interceptor body runs (can short-circuit the request)
2. **Before hooks** — run before the handler (can reply early)
3. **Handler execution** — your route handler runs
4. **After hooks** — run after the handler (can transform the response)
5. **Error hooks** — run if an error is thrown at any point

::: tip
See the [Event Lifecycle Diagram](/moost/event-lifecycle#diagram) for the full picture of how interceptors fit into the request flow.
:::

## Writing a functional interceptor

Use `defineInterceptorFn` to create an interceptor. It receives three hook registrars: `before`, `after`, and `onError`.

```ts
import { defineInterceptorFn } from 'moost'

const timing = defineInterceptorFn((before, after, onError) => {
    const start = Date.now()

    after((response, reply) => {
        const ms = Date.now() - start
        console.log(`Request took ${ms}ms`)
        // response is the handler's return value
        // call reply(newValue) to override it
    })

    onError((error, reply) => {
        const ms = Date.now() - start
        console.log(`Request failed after ${ms}ms: ${error.message}`)
        // call reply(value) to replace the error response
    })
})
```

### The `before` hook

The `before` callback runs before the handler. Call `reply(value)` to skip the handler entirely and respond immediately:

```ts
const cacheInterceptor = defineInterceptorFn((before, after) => {
    before((reply) => {
        const cached = cache.get(currentUrl())
        if (cached) {
            reply(cached) // skip handler, respond with cached value
        }
    })

    after((response) => {
        cache.set(currentUrl(), response)
    })
})
```

### The `after` hook

Receives the handler's response. Call `reply(newValue)` to replace it:

```ts
const wrapper = defineInterceptorFn((before, after) => {
    after((response, reply) => {
        reply({ data: response, timestamp: Date.now() })
    })
})
```

### The `onError` hook

Receives the thrown error. Call `reply(value)` to send a custom error response:

```ts
const errorFormatter = defineInterceptorFn((before, after, onError) => {
    onError((error, reply) => {
        reply({
            error: error.message,
            code: error.statusCode || 500,
        })
    })
})
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

Set priority as the second argument:

```ts
import { defineInterceptorFn, TInterceptorPriority } from 'moost'

const guard = defineInterceptorFn(() => {
    // auth check logic
}, TInterceptorPriority.GUARD)
```

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
    public() { /* not protected */ }
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
import { Intercept, defineInterceptorFn, TInterceptorPriority } from 'moost'

const guardFn = defineInterceptorFn(() => {
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
    const fn = defineInterceptorFn(() => {
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

When you need dependency injection in your interceptor, use a class:

```ts
import { Injectable, TInterceptorPriority } from 'moost'
import type { TInterceptorClass, TInterceptorFn } from 'moost'

@Injectable()
export class AuthInterceptor implements TInterceptorClass {
    static priority = TInterceptorPriority.GUARD

    constructor(private authService: AuthService) {}

    handler: TInterceptorFn = (before, after, onError) => {
        before((reply) => {
            if (!this.authService.isAuthenticated()) {
                throw new HttpError(401)
            }
        })
    }
}
```

Apply it the same way:

```ts
@Intercept(AuthInterceptor)
@Controller()
export class ProtectedController { /* ... */ }
```

Moost creates the interceptor class through DI, so `AuthService` is injected automatically.

## Practical example: request logger

```ts
import { defineInterceptorFn, TInterceptorPriority } from 'moost'
import { useRequest } from '@wooksjs/event-http'
import { useLogger } from '@wooksjs/event-core'

export const requestLogger = defineInterceptorFn((before, after, onError) => {
    const { url, method, reqId } = useRequest()
    const logger = useLogger('http')
    const start = Date.now()

    after(() => {
        logger.log(`${method} ${url} [${reqId()}] ${Date.now() - start}ms`)
    })

    onError((error) => {
        logger.error(`${method} ${url} [${reqId()}] FAILED: ${error.message}`)
    })
}, TInterceptorPriority.BEFORE_ALL)
```

## Practical example: error handler

```ts
import { defineInterceptorFn, TInterceptorPriority } from 'moost'
import { useResponse } from '@wooksjs/event-http'

export const errorHandler = defineInterceptorFn((before, after, onError) => {
    const response = useResponse()

    onError((error, reply) => {
        const status = error.statusCode || 500
        response.status = status
        reply({
            error: error.message,
            statusCode: status,
        })
    })
}, TInterceptorPriority.CATCH_ERROR)
```
