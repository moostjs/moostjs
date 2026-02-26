# Commands

Every CLI command in Moost is a method decorated with `@Cli()`. The decorator argument defines the command path — the words a user types to invoke it.

## Defining a command

```ts
import { Cli, Controller } from '@moostjs/event-cli'

@Controller()
export class AppController {
  @Cli('deploy')
  deploy() {
    return 'Deploying...'
  }
}
```

Running `my-cli deploy` calls the `deploy()` method and prints the return value.

## Command paths

A command path is a sequence of segments separated by spaces or slashes (both are equivalent):

```ts
// These two are identical:
@Cli('config set')
@Cli('config/set')
```

The user always types space-separated words:

```bash
my-cli config set
```

## Positional arguments

Segments that start with `:` become positional arguments:

```ts
@Cli('greet/:name')
greet(@Param('name') name: string) {
  return `Hello, ${name}!`
}
```

```bash
my-cli greet World        # → Hello, World!
```

Multiple arguments work the same way:

```ts
@Cli('copy/:source/:dest')
copy(
  @Param('source') source: string,
  @Param('dest') dest: string,
) {
  return `Copying ${source} → ${dest}`
}
```

```bash
my-cli copy fileA.txt fileB.txt
```

## Escaped colons

If a command name contains a literal colon (like `build:dev`), escape it with a backslash:

```ts
@Cli('build\\:dev')
buildDev() {
  return 'Building for dev...'
}
```

```bash
my-cli build:dev
```

## Default path from method name

When `@Cli()` is called without an argument, the method name becomes the command:

```ts
@Cli()
status() {
  return 'All systems operational'
}
```

```bash
my-cli status
```

## Command aliases

Use `@CliAlias()` to define alternative names for a command. Stack multiple decorators for multiple aliases:

```ts
import { Cli, CliAlias, Controller } from '@moostjs/event-cli'

@Controller()
export class AppController {
  @Cli('install/:package')
  @CliAlias('i/:package')
  @CliAlias('add/:package')
  install(@Param('name') pkg: string) {
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

## Return values

Whatever a command handler returns is printed to stdout. Return a string for plain text, or an object/array for JSON output:

```ts
@Cli('info')
info() {
  return { name: 'my-app', version: '1.0.0' }
}
```

```bash
my-cli info
# → {"name":"my-app","version":"1.0.0"}
```

## What's next

- [Options & Arguments](./options) — add flags like `--verbose` and typed parameters
- [Controllers](./controllers) — group commands under prefixes
