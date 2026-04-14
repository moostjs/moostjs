# CLI Adapter — @moostjs/event-cli

Moost adapter for building decorator-driven CLI applications, wrapping @wooksjs/event-cli.

## Table of Contents

1. [Setup](#setup)
2. [Commands](#commands)
3. [Options](#options)
4. [Controllers](#controllers)
5. [Help System](#help-system)
6. [Interceptors](#interceptors)
7. [Advanced](#advanced)
8. [Best Practices](#best-practices)
9. [Gotchas](#gotchas)

## Setup

### Scaffolding

```bash
npm create moost@latest -- --cli
# or with a name:
npm create moost@latest my-cli -- --cli
```

Generated structure:
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

### CliApp quick setup

`CliApp` extends `Moost` with a fluent API:

```ts
import { CliApp } from '@moostjs/event-cli'
import { AppController } from './controllers/app.controller'

new CliApp()
  .controllers(AppController)
  .useHelp({ name: 'my-cli' })
  .useOptions([
    { keys: ['help'], description: 'Display instructions for the command.' },
  ])
  .start()
```

### CliApp methods

| Method | Description |
|--------|-------------|
| `.controllers(...ctrls)` | Register controller classes (shortcut for `registerControllers`) |
| `.useHelp(opts)` | Configure help system (name, title, colors, lookupLevel, maxWidth, maxLeft, mark) |
| `.useOptions(opts)` | Set global CLI options shown in every command's help |
| `.start()` | Create `MoostCli`, attach adapter, apply help interceptor, call `init()` |

### Running the app

```bash
npx tsx src/bin.ts greet World       # development
node dist/bin.js greet World         # production
```

Handler return values are printed to stdout (strings as plain text, objects as JSON).

## Commands

### @Cli(path?: string)

Method decorator. Register a CLI command handler. The `path` defines command words with segments separated by spaces or `/`. Segments starting with `:` are positional arguments. If omitted, the method name becomes the command.

```ts
import { Cli, Controller, Param } from '@moostjs/event-cli'

@Controller()
export class AppController {
  @Cli('deploy/:env')
  deploy(@Param('env') env: string) {
    return `Deploying to ${env}...`
  }
}
```

Space-separated and slash-separated paths are equivalent: `@Cli('config set')` equals `@Cli('config/set')`.

### Path defaults

```ts
@Cli()         // path = method name, e.g. "my-cli status"
status() { return 'All systems operational' }

@Cli('')       // root command (no path segments)
root() { return 'Root handler' }

@Cli('deploy') // explicit path
run() { return 'Deploying...' }
```

### @CliAlias(alias: string)

Method decorator. Define an alternative name for a command. Stack multiple for multiple aliases.

```ts
@Cli('install/:package')
@CliAlias('i/:package')
@CliAlias('add/:package')
install(@Param('package') pkg: string) {
  return `Installing ${pkg}...`
}
// my-cli install lodash | my-cli i lodash | my-cli add lodash
```

### @CliExample(cmd: string, description?: string)

Method decorator. Add a usage example displayed in `--help` output. Stack multiple for multiple examples.

```ts
@Cli('deploy/:env')
@CliExample('deploy dev -p my-app', 'Deploy to development')
@CliExample('deploy prod --verbose', 'Deploy with verbose logging')
deploy(@Param('env') env: string) {
  return `Deploying to ${env}`
}
```

### @Param(name: string)

Parameter decorator (re-exported from `moost`). Extract a positional argument from a `:name` segment.

```ts
@Cli('copy/:source/:dest')
copy(@Param('source') source: string, @Param('dest') dest: string) {
  return `Copying ${source} to ${dest}`
}
// my-cli copy fileA.txt fileB.txt
```

### Pattern: Escaped colons

Literal colons in commands (like `build:dev`) must be escaped:

```ts
@Cli('build\\:dev')
buildDev() { return 'Building for dev...' }
// my-cli build:dev
```

### Pattern: Return values

Return a string for plain text output, or an object/array for JSON:

```ts
@Cli('info')
info() { return { name: 'my-app', version: '1.0.0' } }
```

## Options

### @CliOption(...keys: string[])

Parameter decorator. Bind a parameter to CLI flags. Long names (2+ chars) become `--flag`, single chars become `-f`. Uses `useCliOption(keys[0])` from `@wooksjs/event-cli` under the hood.

```ts
import { Cli, CliOption, Controller, Description, Param } from '@moostjs/event-cli'

@Controller()
export class DeployController {
  @Cli('deploy/:env')
  deploy(
    @Param('env') env: string,
    @Description('Project name')
    @CliOption('project', 'p') project: string,
    @Description('Enable verbose logging')
    @CliOption('verbose', 'v') verbose: boolean,
  ) {
    return `Deploying ${project} to ${env}`
  }
}
// my-cli deploy production --project my-app --verbose
// my-cli deploy production -p my-app -v
```

### @CliGlobalOption(option)

Class decorator. Declare an option shown in help for every command in the controller.

Signature: `@CliGlobalOption({ keys: string[], description?: string, value?: string })`

```ts
@Controller('build')
@CliGlobalOption({ keys: ['verbose', 'v'], description: 'Enable verbose logging' })
export class BuildController {
  @Cli('dev')
  buildDev() { return 'Building for dev...' }
}
```

### @Description(text), @Optional(), @Value(sample)

All from `moost`. `@Description` documents commands/params for help. `@Optional` marks params as not required. `@Value` shows a placeholder in help (cosmetic only, does NOT set a default).

```ts
@Description('Deploy the application')
@Cli('deploy/:env')
deploy(
  @Description('Target environment') @Param('env') env: string,
  @Description('Output dir') @CliOption('out', 'o') @Optional() @Value('<path>') outDir: string,
) { return `Deploying to ${env}, output: ${outDir ?? './dist'}` }
```

### Pattern: Boolean flags

Type `boolean` parameters are registered as boolean flags (no value expected, presence = `true`):

```ts
@Cli('build')
build(
  @CliOption('watch', 'w') watch: boolean,
  @CliOption('minify', 'm') minify: boolean,
) { return `watch=${watch}, minify=${minify}` }
// my-cli build --watch --minify   =>  watch=true, minify=true
// my-cli build -wm                =>  combined short flags
// my-cli build                    =>  watch=undefined, minify=undefined
```

### Pattern: Global options via CliApp

```ts
new CliApp()
  .controllers(AppController)
  .useHelp({ name: 'my-cli' })
  .useOptions([
    { keys: ['help'], description: 'Display instructions for the command.' },
    { keys: ['verbose', 'v'], description: 'Enable verbose output.' },
  ])
  .start()
```

### Decorator summary

| Decorator | Applies to | Purpose |
|-----------|-----------|---------|
| `@Param('name')` | parameter | Extract positional argument from `:name` in path |
| `@CliOption('key', 'k')` | parameter | Bind to `--key` / `-k` flag |
| `@CliGlobalOption({...})` | class | Global option in all commands' help |
| `@Description('...')` | parameter, method | Document for help output |
| `@Optional()` | parameter | Mark as not required |
| `@Value('...')` | parameter | Show sample value in help (cosmetic only) |

## Controllers

### @Controller(prefix?: string)

Class decorator (from `moost`). Group commands under a shared prefix.

```ts
import { Cli, Controller, Param } from '@moostjs/event-cli'

@Controller('user')
export class UserController {
  @Cli('create/:name')
  create(@Param('name') name: string) { return `Created user: ${name}` }

  @Cli('delete/:name')
  delete(@Param('name') name: string) { return `Deleted user: ${name}` }
}
// my-cli user create Alice
// my-cli user delete Bob
```

Without a prefix (`@Controller()`), commands register at the root level.

### @ImportController(ctrl)

Class decorator (from `moost`). Nest a child controller. The child's prefix appends to the parent's. Register only top-level controllers -- children auto-register.

```ts
import { ImportController } from 'moost'

@Controller('view')
export class ViewCommand {
  @Cli(':id')
  view(@Param('id') id: string) { return `Viewing profile ${id}` }
}

@Controller('profile')
@ImportController(ViewCommand)
export class ProfileController {
  @Cli('list')
  list() { return 'Listing profiles...' }
}
// my-cli profile list       =>  ProfileController.list()
// my-cli profile view 42    =>  ViewCommand.view("42")
```

### Path composition

Final command path = **controller prefix** + **child prefix** + **@Cli() path**.

| Parent prefix | Child prefix | `@Cli()` path | Final command |
|--------------|-------------|---------------|---------------|
| `''` (root) | -- | `status` | `status` |
| `remote` | -- | `list` | `remote list` |
| `remote` | `add` | `:name/:url` | `remote add :name :url` |

### Pattern: Multi-level nesting (git remote add)

```ts
@Controller('add')
class RemoteAddController {
  @Cli(':name/:url')
  add(@Param('name') name: string, @Param('url') url: string) {
    return `Adding remote ${name} -> ${url}`
  }
}

@Controller('remote')
@ImportController(RemoteAddController)
class RemoteController {
  @Cli('list')
  list() { return 'Listing remotes...' }
}
// my-cli remote list  |  my-cli remote add origin git@...
```

## Help System

### cliHelpInterceptor(opts?)

Factory function returning a before-interceptor at `BEFORE_ALL` priority. Intercepts `--help` and prints help.

Options:
- `helpOptions?: string[]` -- flags that trigger help (default: `['help']`)
- `colors?: boolean` -- colored output
- `lookupLevel?: number` -- depth for "did you mean?" on unknown commands

```ts
import { cliHelpInterceptor } from '@moostjs/event-cli'

app.applyGlobalInterceptors(
  cliHelpInterceptor({ helpOptions: ['help', 'h'], colors: true, lookupLevel: 3 }),
)
```

### @CliHelpInterceptor(opts?)

Decorator form. Apply to a controller or method to scope help behavior:

```ts
@CliHelpInterceptor({ colors: true, lookupLevel: 3 })
@Controller()
export class AppController { /* ... */ }
```

### useHelp(opts) on CliApp

The simplest way to enable help. Internally calls `cliHelpInterceptor`. Pass options:

| Option | Default | Description |
|--------|---------|-------------|
| `name` | -- | CLI app name shown in usage examples |
| `title` | -- | Title at top of help |
| `colors` | `true` | Colored terminal output |
| `lookupLevel` | `3` | "Did you mean?" suggestion depth |
| `maxWidth` | -- | Max help output width |
| `maxLeft` | -- | Max left column width |
| `mark` | -- | Prefix marker for sections |

### Pattern: Documenting a command

```ts
@Description('Deploy application to a target environment')
@Cli('deploy/:env')
@CliExample('deploy dev -p my-app', 'Deploy "my-app" to development')
deploy(
  @Description('Environment') @Param('env') env: string,
  @Description('Project name') @CliOption('project', 'p') @Value('<my-app>') project: string,
) { return `Deploying ${project} to ${env}` }
```

`my-cli deploy --help` produces sections: DESCRIPTION, USAGE (`$ my-cli deploy <env>`), ARGUMENTS, OPTIONS (with `@Value` placeholders), and EXAMPLES from `@CliExample`.

### Pattern: Unknown command handling

When `lookupLevel` is set, wrong commands trigger "did you mean?" suggestions. Uses `useCommandLookupHelp()` from `@wooksjs/event-cli`.

## Interceptors

Use `define*` helpers from `moost` (re-exported by `@moostjs/event-cli`) to create functional interceptors.

### Helper factories

| Factory | Phase | Import from |
|---------|-------|-------------|
| `defineBeforeInterceptor(fn, priority?)` | Before handler, `reply(value)` to short-circuit | `@moostjs/event-cli` |
| `defineAfterInterceptor(fn, priority?)` | After handler, receives response | `@moostjs/event-cli` |
| `defineErrorInterceptor(fn, priority?)` | On error, `reply(value)` to recover | `moost` (not re-exported) |
| `defineInterceptor(hooks, priority?)` | Combined before/after/error | `@moostjs/event-cli` |

```ts
import { defineBeforeInterceptor, defineAfterInterceptor } from '@moostjs/event-cli'
import { defineErrorInterceptor, TInterceptorPriority } from 'moost'

const guard = defineBeforeInterceptor((reply) => {
  if (!process.env.CI_TOKEN) { console.error('CI_TOKEN required'); process.exit(1) }
}, TInterceptorPriority.GUARD)

const logger = defineAfterInterceptor((response) => {
  console.log('Command returned:', response)
})

const catcher = defineErrorInterceptor((error, reply) => {
  console.error(`Error: ${error.message}`); reply('')
}, TInterceptorPriority.CATCH_ERROR)
```

### Priority levels

| Priority | Value | Typical CLI use |
|----------|-------|-----------------|
| `BEFORE_ALL` | 0 | Help interceptor, early logging |
| `BEFORE_GUARD` | 1 | Setup before guards |
| `GUARD` | 2 | Permission checks, env validation |
| `AFTER_GUARD` | 3 | Post-auth setup |
| `INTERCEPTOR` | 4 | General-purpose (default) |
| `CATCH_ERROR` | 5 | Error formatting |
| `AFTER_ALL` | 6 | Timing, cleanup |

Lower values run first in `before` phase. `after` and `error` use LIFO ordering.

### Pattern: CLI guard and global error handler

```ts
// Guard: apply to specific commands with @Intercept(requireEnvGuard)
const requireEnvGuard = defineBeforeInterceptor(() => {
  if (!process.env.CI_TOKEN) { console.error('CI_TOKEN required'); process.exit(1) }
}, TInterceptorPriority.GUARD)

// Error handler: apply globally
app.applyGlobalInterceptors(defineErrorInterceptor((error, reply) => {
  console.error(`Error: ${error.message}`); reply('')
}, TInterceptorPriority.CATCH_ERROR))
```

### Pattern: Timing interceptor (class-based, FOR_EVENT scope)

```ts
@Interceptor(TInterceptorPriority.BEFORE_ALL, 'FOR_EVENT')
class TimingInterceptor {
  private start = 0
  @Before()
  recordStart() { this.start = performance.now() }
  @After()
  logDuration() { console.log(`Completed in ${(performance.now() - this.start).toFixed(1)}ms`) }
}
```

### Applying interceptors

| Scope | How |
|-------|-----|
| Single command | `@Intercept(fn)` on the method |
| All commands in a controller | `@Intercept(fn)` on the class |
| Every command in the app | `app.applyGlobalInterceptors(fn)` |

## Advanced

### MoostCli -- low-level adapter

`MoostCli` implements `TMoostAdapter<TCliHandlerMeta>`. Use for full control or multi-adapter setups.

Constructor options (`TMoostCliOpts`):
- `wooksCli?: WooksCli | TWooksCliOptions` -- instance or config
- `debug?: boolean` -- internal logging (default: `false`)
- `globalCliOptions?: { keys: string[]; description?: string; type?: TFunction }[]` -- global help options

```ts
import { MoostCli, cliHelpInterceptor } from '@moostjs/event-cli'
import { Moost } from 'moost'

const app = new Moost()
app.applyGlobalInterceptors(cliHelpInterceptor({ colors: true, lookupLevel: 3 }))
app.registerControllers(AppController)
app.adapter(new MoostCli({
  wooksCli: { cliHelp: { name: 'my-cli' } },
  globalCliOptions: [{ keys: ['help'], description: 'Display instructions.' }],
}))
void app.init()
```

### When to use MoostCli vs CliApp

| Use case | Recommendation |
|----------|---------------|
| Standard CLI app | `CliApp` -- less boilerplate |
| Pre-configured WooksCli instance | `MoostCli` -- pass your own instance |
| Multiple adapters (CLI + HTTP) | `MoostCli` -- attach to existing Moost |
| Custom error handling on WooksCli | `MoostCli` -- configure `wooksCli.onError` |

### cliKind

Event type identifier for CLI events, re-exported from `@wooksjs/event-cli`. Use to distinguish event types in composables or adapters.

```ts
import { cliKind } from '@moostjs/event-cli'
```

### Wooks composables

From `@wooksjs/event-cli` and `@wooksjs/event-core`. Work inside any handler or service during a CLI event.

| Composable | Import from | Description |
|-----------|-------------|-------------|
| `useCliOption(name)` | `@wooksjs/event-cli` | Read a single option value (what `@CliOption` uses) |
| `useCliOptions()` | `@wooksjs/event-cli` | Read all parsed options |
| `useRouteParams()` | `@wooksjs/event-core` | Read positional arguments (what `@Param` uses) |
| `useCliHelp()` | `@wooksjs/event-cli` | Access help renderer programmatically |

```ts
import { useCliOption, useCliOptions } from '@wooksjs/event-cli'
import { useRouteParams } from '@wooksjs/event-core'

@Cli('build')
build() {
  const verbose = useCliOption('verbose')
  const allOpts = useCliOptions()
  return 'Building...'
}
```

### Pattern: Multi-adapter CLI + HTTP

Decorate the same method with `@Cli` and `@Get`, attach both adapters:

```ts
@Controller('health')
export class HealthController {
  @Cli('check')
  @Get('check')
  check() { return { status: 'ok', uptime: process.uptime() } }
}

const app = new Moost()
app.registerControllers(HealthController)
app.adapter(new MoostCli())
app.adapter(new MoostHttp()).listen(3000)
void app.init()
```

### Pattern: DI scopes in CLI

- `@Injectable('SINGLETON')` -- one instance for app lifetime (config, DB connections)
- `@Injectable('FOR_EVENT')` -- new instance per CLI command execution (command state)
- Controllers default to `SINGLETON`, which is correct for most CLI apps

## Best Practices

- Use `CliApp` for standard CLI apps; use `MoostCli` only for multi-adapter or advanced setups
- Always call `.useHelp({ name: 'my-cli' })` -- the name makes usage examples clear
- Add `@Description()` to every command and parameter -- it drives `--help` output
- Use `@CliExample()` for non-obvious usage patterns
- Use short aliases for common flags: `@CliOption('verbose', 'v')`
- Type boolean flags as `boolean` so they do not expect a value argument
- Register only top-level controllers -- nested children auto-register via `@ImportController`
- Keep controller nesting to 2-3 levels max for usability
- Use `GUARD` priority for permission/env checks; `CATCH_ERROR` for error formatting
- Apply error handlers globally so every command benefits
- In multi-adapter setups, decorate shared methods with both `@Cli()` and `@Get()`/`@Post()`

## Gotchas

- `@Cli()` without arguments uses the **method name** as the command path
- Command paths with `:` that are NOT parameters must be escaped: `'build\\:dev'`
- Space-separated and slash-separated paths are equivalent: `'config set'` becomes `'config/set'`
- Multiple `@Cli()` on one method register multiple commands to the same handler
- `@Optional()` does not provide a default value -- use `??` for defaults
- `@Value()` is purely cosmetic for help -- it does NOT set a default
- Missing flags yield `undefined`, not `false` for booleans or an error for others
- Registering a child controller directly AND via `@ImportController` causes duplicate commands
- Interceptors run in priority order (lower first), not registration order
- `reply(value)` in before-interceptor skips the handler entirely
- The help interceptor runs at `BEFORE_ALL` -- before guards
- `CliApp.start()` calls `init()` internally -- do not call `init()` again
- Wooks composables only work inside an active event context
- When passing options (not a `WooksCli` instance), `onNotFound` is overridden by the adapter
- `defineErrorInterceptor` is from `moost`, not re-exported by `@moostjs/event-cli`
