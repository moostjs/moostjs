# Getting Started

Build a CLI application with Moost in under a minute.

## Prerequisites

- Node.js 18 or higher
- npm, pnpm, or yarn

## Scaffold a project

```bash
npm create moost -- --cli
```

Or with a project name:

```bash
npm create moost my-cli -- --cli
```

The scaffolder creates:

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

## What you get

**main.ts** — the entry point:
```ts
import { CliApp } from '@moostjs/event-cli'
import { AppController } from './controllers/app.controller'

new CliApp()
  .controllers(AppController)
  .useHelp({ name: 'my-cli' })
  .start()
```

**app.controller.ts** — your first command:
```ts
import { Cli, Param, Controller } from '@moostjs/event-cli'

@Controller()
export class AppController {
  @Cli('greet/:name')
  greet(@Param('name') name: string) {
    return `Hello, ${name}!`
  }
}
```

## Run it

```bash
npm install && npx tsx src/bin.ts greet World
```

You'll see `Hello, World!` in the terminal.

## How it works

1. `new CliApp()` creates a Moost instance pre-configured for CLI
2. `.controllers()` registers classes that contain command handlers
3. `.useHelp()` enables the built-in help system (try `--help`)
4. `.start()` wires everything together and runs the command from `process.argv`

The `@Cli('greet/:name')` decorator registers the method as a CLI command. The `:name` segment becomes a positional argument, extracted by `@Param('name')`.

## What's next

- [Commands](./commands) — command paths, aliases, and routing patterns
- [Options & Arguments](./options) — flags, positional args, and boolean options
- [Controllers](./controllers) — organize commands into logical groups
