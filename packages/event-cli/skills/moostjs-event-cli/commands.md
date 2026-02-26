# Commands — @moostjs/event-cli

> Defining CLI commands, command paths, positional arguments, aliases, and examples.

## Concepts

Every CLI command is a method decorated with `@Cli()`. The decorator argument defines the command path — the words a user types to invoke it. Command paths support positional arguments (`:param` segments), space or slash separation, and escaped colons.

## API Reference

### `@Cli(path?: string)`

Method decorator. Registers the method as a CLI command handler.

- `path` — command path with segments separated by spaces or `/`. Segments starting with `:` are positional arguments. If omitted, the method name is used as the command.

```ts
import { Cli, Controller } from '@moostjs/event-cli'

@Controller()
export class AppController {
  @Cli('deploy/:env')
  deploy(@Param('env') env: string) {
    return `Deploying to ${env}...`
  }
}
```

### `@CliAlias(alias: string)`

Method decorator. Defines an alternative name for a command. Stack multiple decorators for multiple aliases.

```ts
import { Cli, CliAlias, Controller, Param } from '@moostjs/event-cli'

@Controller()
export class AppController {
  @Cli('install/:package')
  @CliAlias('i/:package')
  @CliAlias('add/:package')
  install(@Param('package') pkg: string) {
    return `Installing ${pkg}...`
  }
}
```

All three invoke the same handler:
```bash
my-cli install lodash
my-cli i lodash
my-cli add lodash
```

### `@CliExample(cmd: string, description?: string)`

Method decorator. Adds a usage example displayed in `--help` output. Stack multiple decorators for multiple examples.

```ts
import { Cli, CliExample, Controller } from '@moostjs/event-cli'

@Controller()
export class DeployController {
  @Cli('deploy/:env')
  @CliExample('deploy dev -p my-app', 'Deploy to development')
  @CliExample('deploy prod --verbose', 'Deploy with verbose logging')
  deploy(@Param('env') env: string) {
    return `Deploying to ${env}`
  }
}
```

### `@Param(name: string)`

Parameter decorator (re-exported from `moost`). Extracts a positional argument from a `:name` segment in the command path.

```ts
@Cli('copy/:source/:dest')
copy(
  @Param('source') source: string,
  @Param('dest') dest: string,
) {
  return `Copying ${source} to ${dest}`
}
```

```bash
my-cli copy fileA.txt fileB.txt
```

## Common Patterns

### Pattern: Space-separated vs slash-separated paths

Both notations are equivalent. The user always types space-separated words:

```ts
// These are identical:
@Cli('config set')
@Cli('config/set')
```

```bash
my-cli config set
```

### Pattern: Default path from method name

When `@Cli()` is called without arguments, the method name becomes the command:

```ts
@Cli()
status() {
  return 'All systems operational'
}
```

```bash
my-cli status
```

### Pattern: Escaped colons

If a command contains a literal colon (like `build:dev`), escape it:

```ts
@Cli('build\\:dev')
buildDev() {
  return 'Building for dev...'
}
```

```bash
my-cli build:dev
```

### Pattern: Return values

Whatever a handler returns is printed to stdout. Return a string for plain text, or an object/array for JSON:

```ts
@Cli('info')
info() {
  return { name: 'my-app', version: '1.0.0' }
}
```

## Gotchas

- Command paths with `:` that are NOT parameters must be escaped with `\\:` (e.g. `'build\\:dev'`)
- Space-separated and slash-separated paths are equivalent internally — `'config set'` becomes `'config/set'`
- If you omit the path in `@Cli()`, the method name is used as the command name
- Multiple `@Cli()` decorators on the same method register multiple commands pointing to the same handler
