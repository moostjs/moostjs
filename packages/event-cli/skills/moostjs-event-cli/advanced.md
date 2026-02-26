# Advanced — @moostjs/event-cli

> Manual adapter setup, Wooks composables, DI scopes, multi-adapter patterns, and cliKind.

## Concepts

`CliApp` handles the common case. For advanced scenarios — sharing a Moost instance across adapters, using Wooks composables directly, or fine-tuning DI — use `MoostCli` as a standalone adapter.

Wooks composables are functions that access the current CLI event context (via AsyncLocalStorage). They work anywhere in the handler call chain — in handlers, services, or interceptors.

## API Reference

### `MoostCli`

Low-level CLI adapter class implementing `TMoostAdapter<TCliHandlerMeta>`.

Constructor options (`TMoostCliOpts`):
- `wooksCli?: WooksCli | TWooksCliOptions` — a WooksCli instance or configuration options
- `debug?: boolean` — enable internal logging (default: `false`)
- `globalCliOptions?: { keys: string[]; description?: string; type?: TFunction }[]` — options shown in help for every command

```ts
import { MoostCli, cliHelpInterceptor } from '@moostjs/event-cli'
import { Moost } from 'moost'

const app = new Moost()

app.applyGlobalInterceptors(
  cliHelpInterceptor({ colors: true, lookupLevel: 3 }),
)

app.registerControllers(AppController)

app.adapter(new MoostCli({
  wooksCli: {
    cliHelp: { name: 'my-cli' },
  },
  globalCliOptions: [
    { keys: ['help'], description: 'Display instructions for the command.' },
  ],
}))

void app.init()
```

### When to use MoostCli vs CliApp

| Use case | Recommendation |
|----------|---------------|
| Standard CLI app | `CliApp` — less boilerplate |
| Pre-configured WooksCli instance | `MoostCli` — pass your own instance |
| Multiple adapters (CLI + HTTP) | `MoostCli` — attach to existing Moost instance |
| Custom error handling on WooksCli | `MoostCli` — configure `wooksCli.onError` |

### `cliKind`

Event type identifier for CLI events, re-exported from `@wooksjs/event-cli`. Useful when writing adapters or composables that distinguish event types.

```ts
import { cliKind } from '@moostjs/event-cli'
```

## Wooks composables

These are from `@wooksjs/event-cli` and `@wooksjs/event-core`. They work inside any handler or service during a CLI event.

### `useCliOption(name: string)`

Read a single option value. This is what `@CliOption()` uses under the hood.

```ts
import { useCliOption } from '@wooksjs/event-cli'

@Cli('build')
build() {
  const verbose = useCliOption('verbose')
  if (verbose) console.log('Verbose mode on')
  return 'Building...'
}
```

### `useCliOptions()`

Read all parsed CLI options at once.

```ts
import { useCliOptions } from '@wooksjs/event-cli'

@Cli('build')
build() {
  const opts = useCliOptions()
  // opts: { verbose: true, target: 'production', ... }
  return `Building with ${JSON.stringify(opts)}`
}
```

### `useRouteParams()`

Read positional arguments. This is what `@Param()` uses under the hood.

```ts
import { useRouteParams } from '@wooksjs/event-core'

@Cli('deploy/:env')
deploy() {
  const params = useRouteParams()
  return `Deploying to ${params.get('env')}`
}
```

### `useCliHelp()`

Access the help renderer programmatically.

```ts
import { useCliHelp } from '@wooksjs/event-cli'

@Cli('info')
info() {
  const { print } = useCliHelp()
  print(true) // print help with colors
}
```

## Common Patterns

### Pattern: Multi-adapter CLI + HTTP

A single Moost instance serving both CLI commands and HTTP routes:

```ts
import { Cli, Controller, Param } from '@moostjs/event-cli'
import { Get } from '@moostjs/event-http'

@Controller('health')
export class HealthController {
  @Cli('check')
  @Get('check')
  check() {
    return { status: 'ok', uptime: process.uptime() }
  }
}
```

Wire up both adapters:

```ts
import { MoostCli } from '@moostjs/event-cli'
import { MoostHttp } from '@moostjs/event-http'
import { Moost } from 'moost'

const app = new Moost()
app.registerControllers(HealthController)

app.adapter(new MoostCli())
app.adapter(new MoostHttp()).listen(3000)

void app.init()
```

Now `my-cli health check` and `GET /health/check` both invoke the same handler.

### Pattern: DI scopes in CLI

```ts
import { Injectable } from 'moost'

@Injectable('SINGLETON')
export class ConfigService {
  readonly env = process.env.NODE_ENV ?? 'development'
}

@Injectable('FOR_EVENT')
export class CommandState {
  startedAt = Date.now()
}
```

- `SINGLETON` — one instance for the app lifetime (shared config, DB connections)
- `FOR_EVENT` — new instance per CLI command execution (command-specific state)

Controllers default to `SINGLETON` scope, which is correct for most CLI apps.

## Integration

- Wooks composables (`useCliOption`, `useCliOptions`, etc.) are imported from `@wooksjs/event-cli`
- Route param composables (`useRouteParams`) come from `@wooksjs/event-core`
- DI decorators (`@Injectable`, `@Inject`, `@Provide`) come from `moost`
- HTTP decorators (`@Get`, `@Post`, etc.) come from `@moostjs/event-http`

## Best Practices

- Use `MoostCli` only when `CliApp` isn't flexible enough
- When `debug` is `false` (default), DI container logging is suppressed for clean terminal output
- In multi-adapter setups, decorate shared methods with both `@Cli()` and `@Get()`/`@Post()`
- Composables work in interceptors and services too — not just handlers

## Gotchas

- `MoostCli` calls `app.init()` — don't call `init()` yourself after attaching the adapter in `CliApp.start()`
- Wooks composables only work inside an active event context (during handler execution)
- When using a custom `WooksCli` instance with `MoostCli`, the `onNotFound` callback is overridden by the adapter
