# Core concepts & setup — @moostjs/event-cli

> Installation, project scaffolding, and the mental model for building CLI apps with Moost.

## Concepts

`@moostjs/event-cli` is a Moost adapter that turns decorated TypeScript classes into CLI applications. It wraps `@wooksjs/event-cli` (the Wooks CLI engine) and integrates with Moost's decorator-driven DI, interceptors, and pipes.

The core mental model:
- **Commands** are methods decorated with `@Cli('path')` inside controller classes
- **Controllers** group commands under shared prefixes (like `git remote add`)
- **Options** are method parameters decorated with `@CliOption('flag')`
- **Arguments** are extracted from `:param` segments in command paths via `@Param('name')`
- **CliApp** is a convenience class that wires everything together with one fluent API

## Installation

```bash
npm install @moostjs/event-cli moost @wooksjs/event-core wooks
# or
pnpm add @moostjs/event-cli moost @wooksjs/event-core wooks
```

Peer dependencies: `moost`, `@wooksjs/event-core`, `wooks`.

## Project scaffolding

```bash
npm create moost -- --cli
# or with a name:
npm create moost my-cli -- --cli
```

Creates:
```
my-cli/
├── src/
│   ├── controllers/
│   │   └── app.controller.ts
│   ├── main.ts
│   └── bin.ts
├── package.json
└── tsconfig.json
```

## CliApp — quick setup

`CliApp` extends `Moost` and provides a fluent API for the common case:

```ts
import { CliApp } from '@moostjs/event-cli'
import { AppController } from './controllers/app.controller'

new CliApp()
  .controllers(AppController)       // register controller classes
  .useHelp({ name: 'my-cli' })     // enable --help with app name
  .useOptions([                     // global options shown in all commands
    { keys: ['help'], description: 'Display instructions for the command.' },
  ])
  .start()                          // wire adapters + interceptors, call init()
```

### `CliApp` methods

| Method | Description |
|--------|-------------|
| `.controllers(...ctrls)` | Register one or more controller classes (shortcut for `registerControllers`) |
| `.useHelp(opts)` | Configure the help system (name, title, colors, lookupLevel, maxWidth, maxLeft, mark) |
| `.useOptions(opts)` | Set global CLI options that appear in every command's help |
| `.start()` | Creates `MoostCli`, attaches adapter, applies help interceptor, calls `init()` |

## Exports

All imports come from `'@moostjs/event-cli'`:

| Export | Kind | Purpose |
|--------|------|---------|
| `CliApp` | class | Quick-setup CLI application factory |
| `MoostCli` | class | Low-level adapter (implements `TMoostAdapter`) |
| `Cli` | decorator | Define a CLI command on a method |
| `CliAlias` | decorator | Add an alias for a command |
| `CliExample` | decorator | Add a usage example for help output |
| `CliOption` | decorator | Bind a parameter to a `--flag` |
| `CliGlobalOption` | decorator | Define a global option on a controller class |
| `cliHelpInterceptor` | function | Factory for the help interceptor |
| `CliHelpInterceptor` | decorator | Decorator form of the help interceptor |
| `cliKind` | object | Event type identifier for CLI events |
| `Controller` | decorator | Re-exported from `moost` |
| `Param` | decorator | Re-exported from `moost` |
| `Intercept` | decorator | Re-exported from `moost` |
| `Description` | decorator | Re-exported from `moost` |
| `Optional` | decorator | Re-exported from `moost` |
| `defineBeforeInterceptor` | function | Re-exported from `moost` |
| `defineAfterInterceptor` | function | Re-exported from `moost` |
| `defineInterceptor` | function | Re-exported from `moost` |
| `TInterceptorPriority` | type | Re-exported from `moost` |

## Running the app

```bash
# Development
npx tsx src/bin.ts greet World

# Production (after compiling)
node dist/bin.js greet World
```

The return value of a command handler is printed to stdout.

## Best Practices

- Use `CliApp` for standard CLI apps; use `MoostCli` only when you need full control or multi-adapter setups
- Keep `tsconfig.json` with `"experimentalDecorators": true` and `"emitDecoratorMetadata": true`
- Register only top-level controllers — nested children are auto-registered via `@ImportController`
