---
name: moostjs-event-cli
description: Use this skill when working with @moostjs/event-cli — to build CLI applications with CliApp or MoostCli, define commands with @Cli(), parse flags and options with @CliOption(), organize commands into controllers with @Controller() and @ImportController(), generate auto-help with cliHelpInterceptor() and @CliHelpInterceptor, define command aliases with @CliAlias(), add usage examples with @CliExample(), set global options with @CliGlobalOption(), use composables like useCliOption()/useCliOptions()/useCliHelp(), combine CLI with HTTP via multi-adapter setup, or access cliKind for event type identification.
---

# @moostjs/event-cli

Moost adapter for building decorator-driven CLI applications. Wraps `@wooksjs/event-cli` and integrates with Moost's DI, interceptors, and pipes.

## How to use this skill

Read the domain file that matches the task. Do not load all files — only what you need.

| Domain | File | Load when... |
|--------|------|------------|
| Core concepts & setup | [core.md](core.md) | Starting a new project, understanding the mental model, installing the package |
| Commands | [commands.md](commands.md) | Defining commands with @Cli(), command paths, positional arguments, aliases, examples |
| Options & arguments | [options.md](options.md) | Adding flags with @CliOption(), boolean options, @Description, @Optional, @Value, @CliGlobalOption |
| Controllers | [controllers.md](controllers.md) | Organizing commands into groups, nesting with @ImportController, path composition |
| Help system | [help.md](help.md) | Configuring auto-help, cliHelpInterceptor, @CliHelpInterceptor, unknown command handling |
| Interceptors | [interceptors.md](interceptors.md) | Adding guards, error handlers, timing, cross-cutting CLI logic |
| Advanced | [advanced.md](advanced.md) | Manual MoostCli setup, Wooks composables, DI scopes, multi-adapter CLI+HTTP, cliKind |

## Quick reference

```ts
// Most common imports
import { CliApp, Cli, CliOption, CliAlias, CliExample, CliGlobalOption } from '@moostjs/event-cli'
import { Controller, Param, Description, Optional, Intercept } from '@moostjs/event-cli'
import { cliHelpInterceptor, CliHelpInterceptor } from '@moostjs/event-cli'
import { MoostCli, cliKind } from '@moostjs/event-cli'

// Minimal app
new CliApp()
  .controllers(AppController)
  .useHelp({ name: 'my-cli' })
  .start()
```
