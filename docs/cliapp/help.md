# Help System

A well-built CLI is self-documenting. Moost provides decorators that generate rich `--help` output automatically — descriptions, usage patterns, argument docs, option lists, and examples.

## Describing commands

Use `@Description()` on a method to explain what a command does:

```ts
import { Cli, Controller, Description } from '@moostjs/event-cli'

@Controller()
export class AppController {
  @Description('Deploy the application to a target environment')
  @Cli('deploy/:env')
  deploy(@Param('env') env: string) {
    return `Deploying to ${env}...`
  }
}
```

The description appears at the top of `--help` output for that command.

## Describing arguments and options

Apply `@Description()` to parameters as well:

```ts
@Description('Deploy the application to a target environment')
@Cli('deploy/:env')
deploy(
  @Description('Target environment (production, staging, dev)')
  @Param('env')
  env: string,

  @Description('Project name to deploy')
  @CliOption('project', 'p')
  project: string,
) {
  return `Deploying ${project} to ${env}`
}
```

Each parameter's description appears under the **ARGUMENTS** or **OPTIONS** section in help.

## Usage examples

Add `@CliExample()` to show real usage patterns. Stack multiple decorators for multiple examples:

```ts
import { Cli, CliExample, CliOption, Controller, Description, Param } from '@moostjs/event-cli'

@Controller()
export class DeployController {
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
    project: string,
  ) {
    return `Deploying ${project} to ${env}`
  }
}
```

Running `my-cli deploy --help` produces:

<div class="language-terminal">
<span class="lang">terminal</span>
<pre>
<span class="bright">DESCRIPTION </span>
<span>  Deploy application to a target environment </span>
<span></span>
<span class="bright">USAGE </span>
<span>  $ my-cli deploy <span class="info">&#60;env&#62;</span></span>
<span></span>
<span class="bright">ARGUMENTS </span>
<span>  <span class="info">&#60;env&#62;</span>                   • Environment </span>
<span></span>
<span class="bright">OPTIONS </span>
<span>  <span class="warn">--help</span>                  • Display instructions for the command.</span>
<span>  <span class="warn">-p</span>, <span class="warn">--project</span>           • Project name </span>
<span></span>
<span class="bright">EXAMPLES </span>
<span style="opacity: 0.5">  # Deploy "my-app" to development </span>
<span>  $ my-cli deploy dev -p my-app </span>
<span style="opacity: 0.5">  # Deploy with verbose logging </span>
<span>  $ my-cli deploy prod -p my-app --verbose </span>
</pre>
</div>

## Sample values

Use `@Value()` to display a placeholder next to options in help. This is purely cosmetic — it doesn't set a default:

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

In help output, the option renders as `--target <staging>`.

## Global options

Some options (like `--help` or `--verbose`) should appear in every command's help. There are two ways to define them.

### Via CliApp setup

Pass global options when initializing the app:

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

### Via @CliGlobalOption decorator

Apply `@CliGlobalOption()` to a controller class. The option appears in help for every command in that controller:

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

Both `build dev --help` and `build prod --help` will show the `--verbose` option.

## Enabling the help interceptor

The help system is powered by `cliHelpInterceptor`. With `CliApp`, calling `.useHelp()` sets it up automatically:

```ts
new CliApp()
  .controllers(AppController)
  .useHelp({
    name: 'my-cli',       // shown in usage examples: "$ my-cli ..."
    colors: true,          // colored output (default: true)
    lookupLevel: 3,        // fuzzy command lookup depth (default: 3)
  })
  .start()
```

### Help options reference

| Option | Default | Description |
|--------|---------|-------------|
| `name` | — | CLI app name shown in usage examples |
| `title` | — | Title displayed at the top of help |
| `colors` | `true` | Enable colored terminal output |
| `lookupLevel` | `3` | Depth for fuzzy "did you mean?" suggestions |
| `maxWidth` | — | Maximum width of help output |
| `maxLeft` | — | Maximum width of the left column |
| `mark` | — | Prefix marker for help sections |

## Unknown command handling

When `lookupLevel` is set, typing a wrong command triggers a "did you mean?" suggestion:

```bash
$ my-cli depoly
Did you mean "deploy"?
```

The lookup searches through registered commands up to the specified depth.

## Decorator form

You can also apply the help interceptor as a decorator on a controller or method using `@CliHelpInterceptor()`:

```ts
import { CliHelpInterceptor } from '@moostjs/event-cli'

@CliHelpInterceptor({ colors: true, lookupLevel: 3 })
@Controller()
export class AppController {
  @Cli('deploy')
  deploy() { return 'Deploying...' }
}
```

This is useful when you want help behavior scoped to specific controllers rather than applied globally.

## What's next

- [Interceptors](./interceptors) — add guards, error handling, and cross-cutting logic
- [Advanced](./advanced) — manual adapter setup, composables, and DI
