# Help system — @moostjs/event-cli

> Auto-generated help output, help interceptor configuration, and unknown command handling.

## Concepts

Moost CLI auto-generates `--help` output from decorator metadata: `@Description()` on methods and parameters, `@CliExample()` for usage patterns, `@Value()` for sample values, and `@CliGlobalOption()` for global flags. The help system is powered by `cliHelpInterceptor`, which intercepts `--help` flags and renders formatted help.

## API Reference

### `cliHelpInterceptor(opts?)`

Factory function that returns a before-interceptor at `BEFORE_ALL` priority. Intercepts commands with `--help` and prints help output.

Options:
- `helpOptions?: string[]` — flag names that trigger help (default: `['help']`)
- `colors?: boolean` — enable colored output
- `lookupLevel?: number` — depth for "did you mean?" fuzzy matching on unknown commands

```ts
import { cliHelpInterceptor } from '@moostjs/event-cli'
import { Moost } from 'moost'

const app = new Moost()
app.applyGlobalInterceptors(
  cliHelpInterceptor({
    helpOptions: ['help', 'h'],
    colors: true,
    lookupLevel: 3,
  }),
)
```

### `@CliHelpInterceptor(opts?)`

Decorator form of `cliHelpInterceptor`. Apply to a controller or method to scope help behavior:

```ts
import { CliHelpInterceptor } from '@moostjs/event-cli'

@CliHelpInterceptor({ colors: true, lookupLevel: 3 })
@Controller()
export class AppController {
  @Cli('deploy')
  deploy() { return 'Deploying...' }
}
```

### `useHelp(opts)` on CliApp

The simplest way to enable help. Calls `cliHelpInterceptor` internally:

```ts
new CliApp()
  .controllers(AppController)
  .useHelp({
    name: 'my-cli',       // shown in usage: "$ my-cli ..."
    title: 'My CLI Tool', // title at top of help
    colors: true,          // colored output (default: true)
    lookupLevel: 3,        // fuzzy lookup depth (default: 3)
    maxWidth: 80,          // max help output width
    maxLeft: 30,           // max left column width
    mark: '>',             // prefix marker for sections
  })
  .start()
```

### Help options reference

| Option | Default | Description |
|--------|---------|-------------|
| `name` | — | CLI app name shown in usage examples |
| `title` | — | Title displayed at the top of help |
| `colors` | `true` | Enable colored terminal output |
| `lookupLevel` | `3` | Depth for "did you mean?" suggestions |
| `maxWidth` | — | Maximum width of help output |
| `maxLeft` | — | Maximum width of the left column |
| `mark` | — | Prefix marker for help sections |

## Common Patterns

### Pattern: Full help setup with CliApp

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

### Pattern: Documenting a command

```ts
@Description('Deploy application to a target environment')
@Cli('deploy/:env')
@CliExample('deploy dev -p my-app', 'Deploy "my-app" to development')
@CliExample('deploy prod -p my-app --verbose', 'Deploy with verbose logging')
deploy(
  @Description('Environment')
  @Param('env')
  env: string,

  @Description('Project name')
  @CliOption('project', 'p')
  @Value('<my-app>')
  project: string,
) {
  return `Deploying ${project} to ${env}`
}
```

Running `my-cli deploy --help` produces:
```
DESCRIPTION
  Deploy application to a target environment

USAGE
  $ my-cli deploy <env>

ARGUMENTS
  <env>                   - Environment

OPTIONS
  --help                  - Display instructions for the command.
  -p, --project <my-app>  - Project name

EXAMPLES
  # Deploy "my-app" to development
  $ my-cli deploy dev -p my-app
  # Deploy with verbose logging
  $ my-cli deploy prod -p my-app --verbose
```

### Pattern: Unknown command handling

When `lookupLevel` is set, typing a wrong command triggers suggestions:

```bash
$ my-cli depoly
Did you mean "deploy"?
```

## Integration

- `@Description()` on methods fills the DESCRIPTION section
- `@Description()` on parameters fills ARGUMENTS and OPTIONS sections
- `@CliExample()` fills the EXAMPLES section
- `@Value()` shows sample values next to options
- `@CliGlobalOption()` adds options to every command's help in that controller

## Best Practices

- Always call `.useHelp({ name: 'my-cli' })` — the name makes usage examples clear
- Add `@Description()` to every command and parameter — it's the primary documentation
- Use `@CliExample()` for non-obvious usage patterns
- Set `lookupLevel: 3` for helpful "did you mean?" suggestions
