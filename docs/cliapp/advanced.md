# Advanced

This page covers topics you won't need for most CLI apps but that become useful as your project grows: manual adapter configuration, Wooks composables, dependency injection scopes, and running CLI and HTTP from the same codebase.

## MoostCli adapter (manual setup)

`CliApp` is a convenience wrapper. For full control, use `MoostCli` directly:

```ts
import { MoostCli, cliHelpInterceptor } from '@moostjs/event-cli'
import { Moost } from 'moost'
import { AppController } from './controllers/app.controller'

const app = new Moost()

app.applyGlobalInterceptors(
  cliHelpInterceptor({
    colors: true,
    lookupLevel: 3,
  }),
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

### MoostCli options

| Option | Type | Description |
|--------|------|-------------|
| `wooksCli` | `WooksCli \| object` | A WooksCli instance or configuration options |
| `debug` | `boolean` | Enable internal logging (default: `false`) |
| `globalCliOptions` | `array` | Options shown in help for every command |

When `debug` is `false` (default), DI container logging is suppressed for a clean terminal.

### When to use MoostCli vs CliApp

| Use case | Recommendation |
|----------|---------------|
| Standard CLI app | `CliApp` — less boilerplate |
| Need a pre-configured WooksCli instance | `MoostCli` — pass your own instance |
| Multiple adapters (CLI + HTTP) | `MoostCli` — attach to existing Moost instance |
| Custom error handling on WooksCli | `MoostCli` — configure `wooksCli.onError` |

## Composables

Moost CLI builds on [Wooks](https://wooks.moost.org/), which provides composable functions for reading CLI context inside handlers. These work anywhere within the handler call chain — in the handler itself, in services, or in interceptors.

### useCliOption(name)

Read a single option value. This is what `@CliOption()` uses under the hood:

```ts
import { useCliOption } from '@wooksjs/event-cli'

@Cli('build')
build() {
  const verbose = useCliOption('verbose')
  if (verbose) console.log('Verbose mode on')
  return 'Building...'
}
```

### useCliOptions()

Read all parsed options at once:

```ts
import { useCliOptions } from '@wooksjs/event-cli'

@Cli('build')
build() {
  const opts = useCliOptions()
  // opts: { verbose: true, target: 'production', ... }
  return `Building with ${JSON.stringify(opts)}`
}
```

### useRouteParams()

Read positional arguments. This is what `@Param()` uses under the hood:

```ts
import { useRouteParams } from '@wooksjs/event-core'

@Cli('deploy/:env')
deploy() {
  const params = useRouteParams()
  return `Deploying to ${params.get('env')}`
}
```

### useCliHelp()

Access the help renderer programmatically:

```ts
import { useCliHelp } from '@wooksjs/event-cli'

@Cli('info')
info() {
  const { print } = useCliHelp()
  print(true) // print help with colors
}
```

## Dependency injection scopes

Moost's DI container supports two scopes, both relevant to CLI:

| Scope | Behavior | CLI use case |
|-------|----------|-------------|
| `SINGLETON` | One instance for the entire app lifetime | Shared config, database connections |
| `FOR_EVENT` | New instance per CLI command execution | Command-specific state |

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

Controllers default to `SINGLETON` scope. For most CLI apps this is correct — each command invocation uses the same controller instance, with fresh argument values resolved per call.

::: tip
See [Dependency Injection](/moost/di/) for constructor injection, circular dependencies, and advanced patterns.
:::

## Multi-adapter: CLI + HTTP

A single Moost instance can serve both CLI commands and HTTP routes. Shared controllers work across adapters — decorate methods with both `@Cli()` and `@Get()`:

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

Wire up both adapters on the same Moost instance:

```ts
import { MoostCli } from '@moostjs/event-cli'
import { MoostHttp } from '@moostjs/event-http'
import { Moost } from 'moost'

const app = new Moost()
app.registerControllers(HealthController)

// CLI adapter
app.adapter(new MoostCli())

// HTTP adapter
app.adapter(new MoostHttp()).listen(3000)

void app.init()
```

Now `my-cli health check` and `GET /health/check` both invoke the same handler.

## Event type identifier

The `cliKind` export identifies CLI events in the Wooks context system. This is useful when writing adapters or composables that need to distinguish event types:

```ts
import { cliKind } from '@moostjs/event-cli'
```

## What's next

- [Interceptors guide](/moost/interceptors) — full interceptor lifecycle and class-based patterns
- [Dependency Injection](/moost/di/) — scopes, constructor injection, circular dependencies
- [Pipes & Validation](/moost/pipes/) — transform and validate command arguments
