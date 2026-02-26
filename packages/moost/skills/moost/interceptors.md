# Interceptors — moost

> Interceptor lifecycle, priority levels, `@Intercept` decorator, `InterceptorHandler` internals, and creating custom interceptors.

## Concepts

Interceptors wrap handler execution in an onion-like pattern. They can:
- **Short-circuit** — Return a response before the handler runs
- **Modify responses** — Transform the handler's return value
- **Handle errors** — Catch and replace errors
- **Add side effects** — Logging, tracing, auth checks

### Priority Levels

Interceptors run in priority order (lowest first):

| Priority | Constant | Typical Use |
|----------|----------|-------------|
| 0 | `BEFORE_ALL` | Logging, tracing setup |
| 10 | `BEFORE_GUARD` | Pre-auth setup |
| 20 | `GUARD` | Authentication/authorization checks |
| 30 | `AFTER_GUARD` | Post-auth enrichment |
| 40 | `INTERCEPTOR` | General-purpose (default) |
| 50 | `CATCH_ERROR` | Error handling |
| 60 | `AFTER_ALL` | Response transformation, cleanup |

### Lifecycle Phases

```
before phase (all interceptors, in priority order)
  └─ Each can return a value to short-circuit
handler execution
after phase (in LIFO/reverse order)
  └─ Each receives the response, can modify it
onError phase (if handler threw)
  └─ Each receives the error, can replace it
```

The after/error phases use **LIFO order** (last registered runs first) — creating a wrap-around pattern where the outermost interceptor has first and last access.

## API Reference

### `@Intercept(handler, priority?)`

Registers an interceptor on a class or method. The handler can be a class or a functional interceptor definition.

```ts
import { Intercept, TInterceptorPriority } from 'moost'

@Intercept(MyGuard, TInterceptorPriority.GUARD)
@Controller()
class ProtectedController { }

@Intercept(loggingInterceptor)
@Get('data')
getData() { }
```

### Functional Interceptor (TInterceptorDef)

```ts
import type { TInterceptorDef } from 'moost'

const myInterceptor: TInterceptorDef = {
  // Called before handler — return value to short-circuit
  before(reply: (response: unknown) => void) {
    // Optional: reply(value) to skip handler
  },

  // Called after handler (or after before's reply)
  after(response: unknown, reply: (response: unknown) => void) {
    // Optional: modify response via reply(newValue)
  },

  // Called if handler threw
  onError(error: unknown, reply: (response: unknown) => void) {
    // Optional: recover from error via reply(fallbackValue)
  },
}
```

### Class-Based Interceptor

```ts
import { Injectable, Before, After, OnError } from 'moost'

@Injectable()
class LoggingInterceptor {
  @Before()
  before() {
    console.log('Before handler')
    // Return undefined to continue, or return a value to short-circuit
  }

  @After()
  after(response: unknown) {
    console.log('After handler:', response)
    // Return undefined to keep original, or return new value
  }

  @OnError()
  onError(error: unknown) {
    console.error('Handler error:', error)
  }
}
```

### `InterceptorHandler` (class)

Used internally by `defineMoostEventHandler`. You don't create these directly — they're provided via `opts.getIterceptorHandler()`.

Key properties:
- `count` — Total number of interceptors (0 means skip interceptor phase)
- `countAfter` — Number of after-phase handlers
- `countOnError` — Number of error-phase handlers

Key methods:
- `before()` — Runs all before interceptors. Returns early response or `undefined`
- `fireAfter(response)` — Runs after/error handlers in LIFO order. Returns final response

## Common Patterns

### Pattern: Auth Guard

```ts
const authGuard: TInterceptorDef = {
  before(reply) {
    const token = useHeaders().get('authorization')
    if (!token) {
      reply(new HttpError(401, 'Unauthorized'))
    }
  },
}

@Intercept(authGuard, TInterceptorPriority.GUARD)
@Controller('protected')
class ProtectedController { }
```

### Pattern: Response Wrapper

```ts
const wrapResponse: TInterceptorDef = {
  after(response, reply) {
    reply({ data: response, timestamp: Date.now() })
  },
}
```

### Pattern: Global Error Handler

```ts
app.interceptor({
  handler: {
    onError(error, reply) {
      if (error instanceof HttpError) {
        reply({ error: error.message, status: error.statusCode })
      }
    },
  },
  priority: TInterceptorPriority.CATCH_ERROR,
})
```

## Integration

### With Adapters

Adapters receive `getIterceptorHandler` in `bindHandler()` options. Pass it through to `defineMoostEventHandler()` — interceptors are handled automatically.

For not-found handlers, use `moost.getGlobalInterceptorHandler()` to run global interceptors (CORS, logging) even on unmatched routes.

### With Context Types

Interceptors can check `contextType` to apply only to specific event types:

```ts
const httpOnly: TInterceptorDef = {
  before() {
    // This interceptor is registered globally but only meaningful for HTTP
    // Check event type if needed
  },
}
```

## Best Practices

- Use `GUARD` priority for auth checks — they run before general interceptors
- Use `AFTER_ALL` for response transformations — they run after everything else
- Use `CATCH_ERROR` for error recovery — keeps error handling separate from business logic
- Prefer functional interceptors for simple logic, class-based for complex logic requiring DI
- Return `undefined` from `before()` to continue to the handler; return a value to short-circuit

## Gotchas

- After-phase interceptors run in **LIFO** order (reverse of registration) — the last registered interceptor's `after()` runs first
- If `before()` returns a value, the handler is **skipped** but after-phase interceptors still run
- Error interceptors receive the error as the `response` parameter, not as a thrown exception
- `InterceptorHandler.count === 0` means no interceptors — the entire interceptor phase is skipped for performance
