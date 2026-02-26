# Interceptors

Interceptors wrap command execution with cross-cutting logic — guards, logging, error formatting, timing, and more. They work identically to [Moost interceptors](/moost/interceptors) but here we focus on CLI-specific patterns.

## Quick recap

An interceptor is a function with three hooks:

```ts
import { defineInterceptorFn, TInterceptorPriority } from 'moost'

const myInterceptor = defineInterceptorFn((before, after, onError) => {
  // init phase — runs first, can short-circuit by returning a value

  before((reply) => {
    // runs before the handler
    // call reply(value) to skip the handler and respond early
  })

  after((response, reply) => {
    // runs after the handler
    // response is the handler's return value
    // call reply(newValue) to override
  })

  onError((error, reply) => {
    // runs if the handler (or a prior interceptor) throws
    // call reply(value) to recover
  })
}, TInterceptorPriority.INTERCEPTOR)
```

::: tip
See the [Interceptors guide](/moost/interceptors) for the full lifecycle, priority levels, and class-based interceptors.
:::

## CLI guard example

A guard is just an interceptor at `GUARD` priority. If it returns a value during init, the handler is skipped entirely:

```ts
import { defineInterceptorFn, TInterceptorPriority } from 'moost'

const requireEnvGuard = defineInterceptorFn(() => {
  if (!process.env.CI_TOKEN) {
    console.error('Error: CI_TOKEN environment variable is required')
    process.exit(1)
  }
}, TInterceptorPriority.GUARD)
```

Apply it to a specific command:

```ts
import { Cli, Controller, Intercept } from '@moostjs/event-cli'

@Controller()
export class DeployController {
  @Intercept(requireEnvGuard)
  @Cli('deploy/:env')
  deploy(@Param('env') env: string) {
    return `Deploying to ${env}...`
  }
}
```

Or to every command in a controller:

```ts
@Intercept(requireEnvGuard)
@Controller('deploy')
export class DeployController {
  @Cli('staging')
  staging() { return 'Deploying to staging...' }

  @Cli('production')
  production() { return 'Deploying to production...' }
}
```

## Error handler

Catch errors and format them for the terminal:

```ts
const cliErrorHandler = defineInterceptorFn((_before, _after, onError) => {
  onError((error, reply) => {
    console.error(`Error: ${error.message}`)
    reply('')
  })
}, TInterceptorPriority.CATCH_ERROR)
```

Apply globally so every command benefits:

```ts
import { CliApp } from '@moostjs/event-cli'

const app = new CliApp()
  .controllers(AppController)
  .useHelp({ name: 'my-cli' })
  .start()

// Before .start(), add global interceptors via the Moost API:
const app = new CliApp()
app.applyGlobalInterceptors(cliErrorHandler)
app.controllers(AppController)
app.useHelp({ name: 'my-cli' })
app.start()
```

## Timing interceptor

Measure how long a command takes:

```ts
const timingInterceptor = defineInterceptorFn((before, after) => {
  let start: number

  before(() => {
    start = performance.now()
  })

  after(() => {
    const ms = (performance.now() - start).toFixed(1)
    console.log(`Completed in ${ms}ms`)
  })
}, TInterceptorPriority.AFTER_ALL)
```

## Priority levels

Interceptors run in priority order. Lower numbers run first:

| Priority | Value | Typical use |
|----------|-------|-------------|
| `BEFORE_ALL` | 0 | Help interceptor, early logging |
| `BEFORE_GUARD` | 1 | Setup before guards |
| `GUARD` | 2 | Permission checks, env validation |
| `AFTER_GUARD` | 3 | Post-auth setup |
| `INTERCEPTOR` | 4 | General-purpose (default) |
| `CATCH_ERROR` | 5 | Error formatting |
| `AFTER_ALL` | 6 | Timing, cleanup |

## Applying interceptors

| Scope | How |
|-------|-----|
| Single command | `@Intercept(fn)` on the method |
| All commands in a controller | `@Intercept(fn)` on the class |
| Every command in the app | `app.applyGlobalInterceptors(fn)` |

## What's next

- [Advanced](./advanced) — manual adapter setup, composables, DI scopes, and multi-adapter patterns
- [Interceptors guide](/moost/interceptors) — full lifecycle, class-based interceptors, and more
