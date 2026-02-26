# Options & Arguments

CLI commands usually accept more than just positional arguments. Moost provides decorators for flags (`--verbose`), short aliases (`-v`), optional parameters, and typed values.

## Positional arguments

Positional arguments come from `:param` segments in the command path. Extract them with `@Param()`:

```ts
@Cli('deploy/:env')
deploy(@Param('env') env: string) {
  return `Deploying to ${env}`
}
```

```bash
my-cli deploy production     # → Deploying to production
```

Add `@Description()` to document what the argument means (shown in `--help`):

```ts
@Cli('deploy/:env')
deploy(
  @Description('Target environment (production, staging, dev)')
  @Param('env')
  env: string,
) {
  return `Deploying to ${env}`
}
```

## Option flags

Use `@CliOption()` to bind a parameter to a CLI flag. Pass one or more keys — long names become `--flag`, single-character names become `-f`:

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

## Boolean flags

When a parameter has type `boolean`, Moost automatically registers it as a boolean flag. This means the flag doesn't expect a value — its presence means `true`:

```ts
@Cli('build')
build(
  @CliOption('watch', 'w')
  watch: boolean,

  @CliOption('minify', 'm')
  minify: boolean,
) {
  return `watch=${watch}, minify=${minify}`
}
```

```bash
my-cli build --watch --minify    # → watch=true, minify=true
my-cli build -wm                 # → same (combined short flags)
my-cli build                     # → watch=undefined, minify=undefined
```

## Optional parameters

Mark a parameter as optional with `@Optional()`. Without it, a missing argument may result in `undefined`:

```ts
import { Cli, CliOption, Controller, Optional } from '@moostjs/event-cli'

@Controller()
export class BuildController {
  @Cli('build')
  build(
    @Description('Output directory')
    @CliOption('out', 'o')
    @Optional()
    outDir: string,
  ) {
    return `Output: ${outDir ?? './dist'}`
  }
}
```

`@Optional()` also signals intent to readers of your code and integrates with the help system.

## Sample values

Use `@Value()` to show a placeholder in help output. This doesn't set a default — it only affects `--help` display:

```ts
import { Cli, CliOption, Controller, Description } from '@moostjs/event-cli'
import { Value } from 'moost'

@Controller()
export class TestController {
  @Cli('test/:config')
  test(
    @Description('Configuration file')
    @Param('config')
    config: string,

    @Description('Target environment')
    @CliOption('target', 't')
    @Value('<staging>')
    target: string,

    @Description('Project name')
    @CliOption('project', 'p')
    @Value('<my-app>')
    project: string,
  ) {
    return `Testing ${config}: ${project} in ${target}`
  }
}
```

In `--help`, the options section shows `--target <staging>` and `--project <my-app>`.

## Decorator summary

| Decorator | Applies to | Purpose |
|-----------|-----------|---------|
| `@Param('name')` | parameter | Extract positional argument from `:name` in path |
| `@CliOption('key', 'k')` | parameter | Bind to `--key` / `-k` flag |
| `@Description('...')` | parameter, method | Document for help output |
| `@Optional()` | parameter | Mark as not required |
| `@Value('...')` | parameter | Show sample value in help |

## What's next

- [Controllers](./controllers) — group related commands under prefixes
- [Help System](./help) — customize auto-generated help output
