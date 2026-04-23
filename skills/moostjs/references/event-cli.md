# CLI Adapter — @moostjs/event-cli

Moost adapter over `@wooksjs/event-cli` for decorator-driven CLI apps.

- [Setup](#setup)
- [Commands](#commands)
- [Options](#options)
- [Controllers](#controllers)
- [Help system](#help-system)
- [Interceptors](#interceptors)
- [Advanced: MoostCli](#advanced-moostcli)
- [Gotchas](#gotchas)

## Setup

```bash
npm create moost@latest [name] -- --cli
```

### CliApp (sugar over Moost + MoostCli + help interceptor)

```ts
import { CliApp } from '@moostjs/event-cli'
import { AppController } from './controllers/app.controller'

new CliApp()
  .controllers(AppController)
  .useHelp({ name: 'my-cli' })
  .useOptions([{ keys: ['help'], description: 'Display instructions.' }])
  .start()
```

### CliApp methods

| Method | Notes |
|---|---|
| `.controllers(...)` | shortcut for `registerControllers` |
| `.useHelp(opts)` | `{ name, title, colors, lookupLevel, maxWidth, maxLeft, mark }` — defaults: `colors: true`, `lookupLevel: 3` |
| `.useOptions(opts)` | global CLI options for help |
| `.start()` | creates MoostCli, attaches adapter, applies help interceptor (if `useHelp`), awaits `init()` |

Handler return → stdout (string = plain, object/array = JSON).

## Commands

### `@Cli(path?)`

Register a CLI command. `path` segments separated by spaces or `/`; `:name` = positional. Path defaults to method name. Multiple `@Cli` on one method register multiple commands.

```ts
@Controller()
class AppController {
  @Cli()              // → `my-cli status` (method name)
  status() {}

  @Cli('')            // root command
  root() {}

  @Cli('deploy/:env')
  deploy(@Param('env') env: string) {}

  @Cli('config set')  // space = `/` → `config/set`
  configSet() {}

  @Cli('build\\:dev') // escape literal colons
  buildDev() {}
}
```

### `@CliAlias(alias)` / `@CliExample(cmd, desc?)`

Stack multiples.

```ts
@Cli('install/:package')
@CliAlias('i/:package')
@CliAlias('add/:package')
@CliExample('install lodash', 'Install lodash')
install(@Param('package') pkg: string) {}
```

### `@Param(name)` — from `moost`

```ts
@Cli('copy/:source/:dest')
copy(@Param('source') s: string, @Param('dest') d: string) {}
```

## Options

### `@CliOption(...keys)` — param

Binds to `--key` / `-k`. Long names (≥2 chars) = `--flag`, single char = `-f`. Type `boolean` = flag (no value). Missing = `undefined` (not `false`).

```ts
@Cli('deploy/:env')
deploy(
  @Param('env') env: string,
  @Description('Project name') @CliOption('project', 'p') project: string,
  @Description('Verbose')      @CliOption('verbose', 'v') verbose: boolean,
) {}
// my-cli deploy prod -p app -v
```

### `@CliGlobalOption({ keys, description?, value? })` — class

Shows in every command's help for that controller.

```ts
@Controller('build')
@CliGlobalOption({ keys: ['verbose', 'v'], description: 'Verbose logging' })
class BuildController { @Cli('dev') buildDev() {} }
```

### `@Description`, `@Optional`, `@Value` (from `moost`)

`@Description` → docs for help. `@Optional` → mark not required. `@Value('<path>')` → placeholder in help output (cosmetic only — does NOT set a default; use `??`).

## Controllers

```ts
@Controller('user')
class UserController {
  @Cli('create/:name') create(@Param('name') n: string) {}
  @Cli('delete/:name') delete(@Param('name') n: string) {}
}
// my-cli user create Alice

// Nesting: child prefix is appended.
@Controller('add')
class RemoteAddController {
  @Cli(':name/:url') add(@Param('name') n: string, @Param('url') u: string) {}
}
@Controller('remote')
@ImportController(RemoteAddController)
class RemoteController { @Cli('list') list() {} }
// my-cli remote list   |   my-cli remote add origin git@…
```

Final path = **controller prefix** + **child prefix** + **`@Cli` path**. Register only top-level controllers — `@ImportController` auto-registers descendants.

## Help system

Three equivalent ways:

- `new CliApp().useHelp({ name: 'my-cli' })` — simplest
- Global: `app.applyGlobalInterceptors(cliHelpInterceptor({ colors, lookupLevel, helpOptions }))`
- Scoped: `@CliHelpInterceptor({ colors: true, lookupLevel: 3 })` on class/method

`cliHelpInterceptor` options: `helpOptions?: string[]` (flags triggering help, default `['help']`), `colors?: boolean`, `lookupLevel?: number` ("did you mean?" depth).

`useHelp(opts)` options: `name`, `title`, `colors` (default `true`), `lookupLevel` (default `3`), `maxWidth`, `maxLeft`, `mark`.

Help output sections: DESCRIPTION / USAGE / ARGUMENTS / OPTIONS (with `@Value` placeholders) / EXAMPLES (from `@CliExample`).

Unknown command + `lookupLevel > 0` → "did you mean?" via `useCommandLookupHelp()` from `@wooksjs/event-cli`.

## Interceptors

Use helpers from `moost` (some re-exported by `@moostjs/event-cli`).

| Factory | Re-exported by event-cli? |
|---|---|
| `defineBeforeInterceptor(fn, priority?)` | yes |
| `defineAfterInterceptor(fn, priority?)` | yes |
| `defineInterceptor(hooks, priority?)` | yes |
| `defineErrorInterceptor(fn, priority?)` | **no — import from `moost`** |

Priority: `BEFORE_ALL` < `BEFORE_GUARD` < `GUARD` < `AFTER_GUARD` < `INTERCEPTOR` < `CATCH_ERROR` < `AFTER_ALL`. Typical CLI use: help at `BEFORE_ALL`, env/permission checks at `GUARD`, error formatting at `CATCH_ERROR`.

```ts
const envGuard = defineBeforeInterceptor(() => {
  if (!process.env.CI_TOKEN) { console.error('CI_TOKEN required'); process.exit(1) }
}, TInterceptorPriority.GUARD)

app.applyGlobalInterceptors(
  defineErrorInterceptor((e, reply) => { console.error(`Error: ${e.message}`); reply('') },
    TInterceptorPriority.CATCH_ERROR),
)
```

Class-based timing example (needs `FOR_EVENT` for per-command state):

```ts
@Interceptor(TInterceptorPriority.BEFORE_ALL, 'FOR_EVENT')
class Timing {
  private start = 0
  @Before() recordStart() { this.start = performance.now() }
  @After()  log() { console.log(`${(performance.now() - this.start).toFixed(1)}ms`) }
}
```

Apply via `@Intercept(fn)` on method (single command) / on class (all commands in controller) / `app.applyGlobalInterceptors(fn)` (every command).

## Advanced: MoostCli

Low-level adapter. Use when: pre-configured `WooksCli`, multi-adapter (CLI + HTTP), custom `onError`.

```ts
new MoostCli({
  wooksCli?: WooksCli | TWooksCliOptions,
  debug?: boolean,
  globalCliOptions?: { keys: string[]; description?: string; type?: TFunction }[],
})
```

```ts
const app = new Moost()
app.applyGlobalInterceptors(cliHelpInterceptor({ colors: true, lookupLevel: 3 }))
app.registerControllers(AppController)
app.adapter(new MoostCli({
  wooksCli: { cliHelp: { name: 'my-cli' } },
  globalCliOptions: [{ keys: ['help'], description: 'Display instructions.' }],
}))
await app.init()
```

### Wooks composables

From `@wooksjs/event-cli` / `@wooksjs/event-core`:

| Composable | Purpose |
|---|---|
| `useCliOption(name)` | read one option (what `@CliOption` uses) |
| `useCliOptions()` | read all parsed options |
| `useRouteParams()` | positional args (what `@Param` uses) |
| `useCliHelp()` | programmatic help renderer |

`cliKind` — event kind marker, re-exported from `@moostjs/event-cli`.

### Multi-adapter CLI + HTTP

```ts
@Controller('health')
class HealthController {
  @Cli('check')
  @Get('check')
  check() { return { status: 'ok', uptime: process.uptime() } }
}
```

## Gotchas

- `@Cli()` with no arg → **method name** path. `@Cli('')` = root.
- Literal colons must be escaped: `@Cli('build\\:dev')`.
- Missing flags → `undefined`, not `false` (even for booleans).
- `@Optional` doesn't set a default — use `??`.
- `@Value` is cosmetic only.
- Registering a child controller directly AND via `@ImportController` duplicates commands.
- `reply(v)` in a before-interceptor skips the handler.
- Help interceptor runs at `BEFORE_ALL` — before guards.
- `CliApp.start()` calls `init()` internally — don't call it again.
- `defineErrorInterceptor` is **not** re-exported from `@moostjs/event-cli` — import from `moost`.
- Passing options (not a `WooksCli` instance) to `MoostCli`: the adapter overrides `onNotFound`.
