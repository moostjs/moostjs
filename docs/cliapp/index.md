# Getting Started

Build a CLI application with Moost in under a minute.

## Prerequisites

- Node.js 20.19+ (or 22.12+) — required by Rolldown, which builds the scaffolded CLI
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
│   └── main.ts
├── bin.js
├── package.json
├── rolldown.config.ts
└── tsconfig.json
```

## What you get

**src/main.ts** — the entry point with your first command:

```ts
import { CliApp, Cli, CliOption, Controller, Description, Param } from '@moostjs/event-cli'

@Controller()
class Commands {
  @Description('Prints a greeting')
  @Cli('hello/:name')
  greet(
    @Description('A name to greet')
    @Param('name')
    name: string,

    @Description('Whether to print the greeting in uppercase')
    @CliOption('uppercase', 'u')
    uppercase: boolean,
  ) {
    const output = `Hello, ${name}!`
    return uppercase ? output.toUpperCase() : output
  }
}

new CliApp()
  .controllers(Commands)
  .useHelp({ name: 'my-cli' })
  .useOptions([{ keys: ['help'], description: 'Display instructions for the command.' }])
  .start()
```

**bin.js** — the executable referenced by the `bin` field in `package.json`; it imports the bundled `dist/main.js` produced by the build.

## Run it

```bash
npm install
npm run build
node dist/main.js hello World
```

You'll see `Hello, World!` in the terminal. Try `node dist/main.js hello World -u` for `HELLO, WORLD!`, or `--help` for generated help output.

::: tip
The template's `dev` script rebuilds and runs in one step: `pnpm dev hello World` (it uses pnpm internally).
:::

## How it works

1. `new CliApp()` creates a Moost instance pre-configured for CLI
2. `.controllers()` registers classes that contain command handlers
3. `.useHelp()` enables the built-in help system (try `--help`)
4. `.useOptions()` registers global options shown in every command's help
5. `.start()` wires everything together and runs the command from `process.argv`

The `@Cli('hello/:name')` decorator registers the method as a CLI command. The `:name` segment becomes a positional argument, extracted by `@Param('name')`.

## AI Agent Skill

Install the unified Moost AI skill for context-aware assistance in AI coding agents (Claude Code, Cursor, Windsurf, Codex, etc.):

```bash
npx skills add moostjs/moostjs
```

## What's next

- [Commands](./commands) — command paths, aliases, and routing patterns
- [Options & Arguments](./options) — flags, positional args, and boolean options
- [Controllers](./controllers) — organize commands into logical groups
- [Help System](./help) — descriptions, examples, and auto-generated `--help`
- [Interceptors](./interceptors) — guards, error handling, and cross-cutting logic
- [Advanced](./advanced) — manual adapter setup, composables, and multi-adapter apps
