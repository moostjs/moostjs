# Options & arguments — @moostjs/event-cli

> CLI flags, boolean options, optional parameters, descriptions, sample values, and global options.

## Concepts

CLI commands accept two kinds of input:
- **Positional arguments** — extracted from `:param` segments in the command path via `@Param()`
- **Option flags** — bound to `--flag`/`-f` style switches via `@CliOption()`

Additional decorators control documentation and behavior: `@Description()`, `@Optional()`, `@Value()`, and `@CliGlobalOption()`.

## API Reference

### `@CliOption(...keys: string[])`

Parameter decorator. Binds the parameter to one or more CLI flags. Long names (2+ chars) become `--flag`, single chars become `-f`.

Under the hood, this calls `useCliOption(keys[0])` from `@wooksjs/event-cli` via a `@Resolve()` pipe.

```ts
import { Cli, CliOption, Controller, Description, Param } from '@moostjs/event-cli'

@Controller()
export class DeployController {
  @Cli('deploy/:env')
  deploy(
    @Param('env') env: string,

    @Description('Project name')
    @CliOption('project', 'p')
    project: string,

    @Description('Enable verbose logging')
    @CliOption('verbose', 'v')
    verbose: boolean,
  ) {
    if (verbose) console.log(`Project: ${project}, env: ${env}`)
    return `Deploying ${project} to ${env}`
  }
}
```

```bash
my-cli deploy production --project my-app --verbose
my-cli deploy production -p my-app -v          # same thing
```

### `@CliGlobalOption(option: { keys: string[]; description?: string; value?: string })`

Class decorator. Declares an option that appears in help output for every command in the controller.

```ts
import { Cli, CliGlobalOption, Controller } from '@moostjs/event-cli'

@Controller('build')
@CliGlobalOption({
  keys: ['verbose', 'v'],
  description: 'Enable verbose logging',
})
export class BuildController {
  @Cli('dev')
  buildDev() { return 'Building for dev...' }

  @Cli('prod')
  buildProd() { return 'Building for prod...' }
}
```

### `@Description(text: string)`

Parameter or method decorator (re-exported from `moost`). Documents the parameter or command for help output.

```ts
@Description('Deploy the application to a target environment')
@Cli('deploy/:env')
deploy(
  @Description('Target environment (production, staging, dev)')
  @Param('env')
  env: string,
) {
  return `Deploying to ${env}...`
}
```

### `@Optional()`

Parameter decorator (re-exported from `moost`). Marks a parameter as not required. Integrates with the help system.

```ts
@Cli('build')
build(
  @Description('Output directory')
  @CliOption('out', 'o')
  @Optional()
  outDir: string,
) {
  return `Output: ${outDir ?? './dist'}`
}
```

### `@Value(sample: string)`

Parameter decorator (from `moost`). Shows a placeholder in help output. Does NOT set a default value.

```ts
import { Value } from 'moost'

@Cli('test/:config')
test(
  @Description('Target environment')
  @CliOption('target', 't')
  @Value('<staging>')
  target: string,
) {
  return `Testing in ${target}`
}
```

In help: `--target <staging>`.

## Common Patterns

### Pattern: Boolean flags

When a parameter has type `boolean`, Moost automatically registers it as a boolean flag (no value expected — presence means `true`):

```ts
@Cli('build')
build(
  @CliOption('watch', 'w') watch: boolean,
  @CliOption('minify', 'm') minify: boolean,
) {
  return `watch=${watch}, minify=${minify}`
}
```

```bash
my-cli build --watch --minify    # watch=true, minify=true
my-cli build -wm                 # combined short flags
my-cli build                     # watch=undefined, minify=undefined
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

## Decorator summary

| Decorator | Applies to | Purpose |
|-----------|-----------|---------|
| `@Param('name')` | parameter | Extract positional argument from `:name` in path |
| `@CliOption('key', 'k')` | parameter | Bind to `--key` / `-k` flag |
| `@CliGlobalOption({...})` | class | Global option shown in all commands' help |
| `@Description('...')` | parameter, method | Document for help output |
| `@Optional()` | parameter | Mark as not required |
| `@Value('...')` | parameter | Show sample value in help |

## Best Practices

- Always add `@Description()` to options and arguments — it drives `--help` output
- Use short aliases (single char) for frequently-used flags: `@CliOption('verbose', 'v')`
- Type boolean flags as `boolean` so they don't expect a value argument
- Use `@Value()` for non-obvious option formats (e.g., `@Value('<host:port>')`)

## Gotchas

- `@Optional()` does not provide a default value — it only marks the parameter as optional. Use `??` in your code for defaults
- `@Value()` is purely cosmetic for help display — it does NOT set a default value
- Without `@Optional()`, a missing flag results in `undefined` (not an error)
- Boolean flags that are absent yield `undefined`, not `false`
