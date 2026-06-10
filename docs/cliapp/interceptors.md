# Interceptors

Interceptors wrap command execution with cross-cutting logic — guards, logging, error formatting, timing, and more. They work identically to [Moost interceptors](/moost/interceptors) but here we focus on CLI-specific patterns.

## Quick recap

Interceptors have three lifecycle hooks — `before`, `after`, and `error`. Use the `define*` helpers to create them:

```ts
import { defineBeforeInterceptor, TInterceptorPriority } from 'moost'

// Runs before the handler — call reply(value) to skip the handler
const guard = defineBeforeInterceptor((reply) => {
  // check something, throw or call reply() to short-circuit
}, TInterceptorPriority.GUARD)
```

```ts
import { defineAfterInterceptor } from 'moost'

// Runs after the handler — receives the response
const logger = defineAfterInterceptor((response) => {
  console.log('Command returned:', response)
})
```

```ts
import { defineErrorInterceptor } from 'moost'

// Runs on error — receives the error, call reply(value) to recover
const errorHandler = defineErrorInterceptor((error, reply) => {
  console.error(`Error: ${error.message}`)
  reply('')
})
```

Or combine all hooks with `defineInterceptor`:

```ts
import { defineInterceptor, TInterceptorPriority } from 'moost'

const myInterceptor = defineInterceptor({
  before(reply) { /* ... */ },
  after(response, reply) { /* ... */ },
  error(error, reply) { /* ... */ },
}, TInterceptorPriority.INTERCEPTOR)
```

::: tip
See the [Interceptors guide](/moost/interceptors) for the full lifecycle, priority levels, and class-based interceptors.
:::

## CLI guard example

A guard is a before-interceptor at `GUARD` priority. Throw or call `reply()` to stop execution:

```ts
import { defineBeforeInterceptor, TInterceptorPriority } from 'moost'

const requireEnvGuard = defineBeforeInterceptor(() => {
  if (!process.env.CI_TOKEN) {
    console.error('Error: CI_TOKEN environment variable is required')
    process.exit(1)
  }
}, TInterceptorPriority.GUARD)
```

Apply it to a specific command:

```ts
import { Cli, Controller, Intercept, Param } from '@moostjs/event-cli'

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
import { defineErrorInterceptor, TInterceptorPriority } from 'moost'

const cliErrorHandler = defineErrorInterceptor((error, reply) => {
  console.error(`Error: ${error.message}`)
  reply('')
}, TInterceptorPriority.CATCH_ERROR)
```

Apply globally so every command benefits:

```ts
import { CliApp } from '@moostjs/event-cli'

const app = new CliApp()
app.applyGlobalInterceptors(cliErrorHandler)
app.controllers(AppController)
app.useHelp({ name: 'my-cli' })
app.start()
```

## Timing interceptor

Measure how long a command takes using a class-based interceptor with `FOR_EVENT` scope:

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
    console.log(`Completed in ${ms}ms`)
  }
}
```

Or as a functional interceptor:

```ts
import { defineInterceptor, TInterceptorPriority } from 'moost'

let start: number
const timingInterceptor = defineInterceptor({
  before() {
    start = performance.now()
  },
  after() {
    const ms = (performance.now() - start).toFixed(1)
    console.log(`Completed in ${ms}ms`)
  },
}, TInterceptorPriority.BEFORE_ALL)
```

::: tip Why `BEFORE_ALL`?
Priority defines an onion: `before` hooks run lowest-priority-first, while `after`/`error` hooks run in reverse. `BEFORE_ALL` makes the timing interceptor the outermost layer, so it measures the whole pipeline (other interceptors included). An `AFTER_ALL` timing interceptor would be the innermost layer and measure roughly just the handler.
:::

## Priority levels

Priorities range from `BEFORE_ALL` (0, outermost) to `AFTER_ALL` (6, innermost) — see the canonical [priority table](/moost/interceptors#key-concepts) in the Moost interceptors guide. CLI-specific notes:

- `cliHelpInterceptor` runs at `BEFORE_ALL`, so `--help` is handled before any guards run
- use `GUARD` for env/permission checks and `CATCH_ERROR` for terminal error formatting

## Applying interceptors

| Scope | How |
|-------|-----|
| Single command | `@Intercept(fn)` on the method |
| All commands in a controller | `@Intercept(fn)` on the class |
| Every command in the app | `app.applyGlobalInterceptors(fn)` |

## What's next

- [Advanced](./advanced) — manual adapter setup, composables, DI scopes, and multi-adapter patterns
- [Interceptors guide](/moost/interceptors) — full lifecycle, class-based interceptors, and more
