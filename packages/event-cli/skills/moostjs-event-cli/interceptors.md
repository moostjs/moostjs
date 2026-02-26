# Interceptors — @moostjs/event-cli

> Guards, error handlers, timing, and cross-cutting CLI logic.

## Concepts

Interceptors wrap command execution with cross-cutting logic. They have three lifecycle hooks: `before`, `after`, and `error`. Each runs at a configurable priority level. They work identically to Moost interceptors but are applied in a CLI context.

Use the `define*` helpers from `moost` (re-exported by `@moostjs/event-cli`) to create functional interceptors.

## API Reference

### `defineBeforeInterceptor(fn, priority?)`

Creates an interceptor that runs before the handler. Call `reply(value)` to short-circuit and skip the handler.

```ts
import { defineBeforeInterceptor, TInterceptorPriority } from '@moostjs/event-cli'

const guard = defineBeforeInterceptor((reply) => {
  if (!process.env.CI_TOKEN) {
    console.error('Error: CI_TOKEN required')
    process.exit(1)
  }
}, TInterceptorPriority.GUARD)
```

### `defineAfterInterceptor(fn, priority?)`

Creates an interceptor that runs after the handler. Receives the response.

```ts
import { defineAfterInterceptor } from '@moostjs/event-cli'

const logger = defineAfterInterceptor((response) => {
  console.log('Command returned:', response)
})
```

### `defineErrorInterceptor(fn, priority?)`

Creates an interceptor that runs on error. Call `reply(value)` to recover.

```ts
import { defineErrorInterceptor, TInterceptorPriority } from '@moostjs/event-cli'

const errorHandler = defineErrorInterceptor((error, reply) => {
  console.error(`Error: ${error.message}`)
  reply('')
}, TInterceptorPriority.CATCH_ERROR)
```

### `defineInterceptor(hooks, priority?)`

Combines all hooks in one interceptor:

```ts
import { defineInterceptor, TInterceptorPriority } from '@moostjs/event-cli'

const myInterceptor = defineInterceptor({
  before(reply) { /* ... */ },
  after(response, reply) { /* ... */ },
  error(error, reply) { /* ... */ },
}, TInterceptorPriority.INTERCEPTOR)
```

### Priority levels

| Priority | Value | Typical use |
|----------|-------|-------------|
| `BEFORE_ALL` | 0 | Help interceptor, early logging |
| `BEFORE_GUARD` | 1 | Setup before guards |
| `GUARD` | 2 | Permission checks, env validation |
| `AFTER_GUARD` | 3 | Post-auth setup |
| `INTERCEPTOR` | 4 | General-purpose (default) |
| `CATCH_ERROR` | 5 | Error formatting |
| `AFTER_ALL` | 6 | Timing, cleanup |

## Common Patterns

### Pattern: CLI guard

```ts
import { Cli, Controller, Intercept } from '@moostjs/event-cli'
import { defineBeforeInterceptor, TInterceptorPriority } from '@moostjs/event-cli'

const requireEnvGuard = defineBeforeInterceptor(() => {
  if (!process.env.CI_TOKEN) {
    console.error('Error: CI_TOKEN environment variable is required')
    process.exit(1)
  }
}, TInterceptorPriority.GUARD)

@Controller()
export class DeployController {
  @Intercept(requireEnvGuard)
  @Cli('deploy/:env')
  deploy(@Param('env') env: string) {
    return `Deploying to ${env}...`
  }
}
```

### Pattern: Global error handler

```ts
const cliErrorHandler = defineErrorInterceptor((error, reply) => {
  console.error(`Error: ${error.message}`)
  reply('')
}, TInterceptorPriority.CATCH_ERROR)

const app = new CliApp()
app.applyGlobalInterceptors(cliErrorHandler)
app.controllers(AppController)
app.useHelp({ name: 'my-cli' })
app.start()
```

### Pattern: Timing interceptor

Class-based with `FOR_EVENT` scope (fresh instance per command):

```ts
import { Interceptor, Before, After, TInterceptorPriority } from 'moost'

@Interceptor(TInterceptorPriority.BEFORE_ALL, 'FOR_EVENT')
class TimingInterceptor {
  private start = 0

  @Before()
  recordStart() { this.start = performance.now() }

  @After()
  logDuration() {
    const ms = (performance.now() - this.start).toFixed(1)
    console.log(`Completed in ${ms}ms`)
  }
}
```

## Applying interceptors

| Scope | How |
|-------|-----|
| Single command | `@Intercept(fn)` on the method |
| All commands in a controller | `@Intercept(fn)` on the class |
| Every command in the app | `app.applyGlobalInterceptors(fn)` |

## Best Practices

- Use `GUARD` priority for permission/env checks that should block execution
- Use `CATCH_ERROR` for terminal-friendly error formatting
- Apply error handlers globally so every command benefits
- Use `FOR_EVENT` scope for class-based interceptors that track per-command state (like timing)

## Gotchas

- Interceptors run in priority order (lower numbers first), not registration order
- `reply(value)` in a before-interceptor skips the handler entirely — the value becomes the response
- The help interceptor runs at `BEFORE_ALL` — it runs before guards
