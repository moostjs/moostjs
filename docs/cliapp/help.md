# Command Usage

<span class="cli-header"><span class="cli-path">/cliapp</span><span class="cli-invite">$</span> moost cli --help<span class="cli-blink">|</span></span>

::: info
Creating a great command-line interface (CLI) is not just about functionality but also about usability.
Moost CLI provides a set of decorators to help you define rich command metadata and examples.
This makes your CLI self-descriptive and user-friendly, especially when someone uses the `--help` option.
:::

## Defining Command Metadata

To define command metadata, Moost provides several decorators:

- `@Cli`: To define a command.
- `@CliAlias`: To define an alias for a command.
- `@CliOption`: To define a command option.
- `@Description`: To provide a description for a command, argument or option.
- `@CliExample`: To provide a usage example for a command.
- `@Value`: To provide a sample value for an option.

Here's an example of how you might use these decorators to define a CLI controller:

```ts
import { Controller, Description, Param, Value } from 'moost'
import { Cli, CliOption, CliAlias, CliExample } from '@moostjs/event-cli'

@Controller()
export class CliController {
    @Cli('start')
    @CliAlias('begin') // Command alias
    start() {
        return 'Starting application...'
    }

    @Description('Deploy application to a target environment')
    @Cli('deploy :env')
    @CliExample('dev -p my-app', 'Deploy the "my-app" to the development environment')
    deploy(
        @Description('Environment')
        @Param('env')
        env: string,

        @Description('Target cluster')
        @CliOption('target', 't')
        target: string,

        @Description('Project name')
        @CliOption('project', 'p')
        project: string,
    ) {
        return `Deploying ${project} to ${target} | env = ${ env }`
    }

    @Description('Test application with specific configuration')
    @Cli('test :config')
    test(
        @Description('Configuration file')
        @Param('config')
        config: string,

        @Description('Target environment')
        @Value('<staging>')
        @CliOption('target', 't')
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

In the above example, we define a `CliController` with three commands: `start`, `deploy`, and `test`.
Each command has its metadata defined using the decorators.

If you run command `deploy --help`, you'll see this nice command usage:
<div class="language-terminal">
<span class="lang">terminal</span>
<pre>
<span class="bright">DESCRIPTION </span>
<span>  Deploy application to a target environment </span>
<span></span>
<span class="bright">USAGE </span>
<span>  $ my-cli deploy <span class="info">&#60;env&#62; &#60;name&#62;</span></span>
<span></span>
<span class="bright">ARGUMENTS </span>
<span>  <span class="info">&#60;env&#62;</span>                   • Environment </span>
<span>  <span class="info">&#60;name&#62;</span>                  • App Name </span>
<span></span>
<span class="bright">OPTIONS </span>
<span>  <span class="warn">--help</span>                  • Display instructions for the command.</span>
<span>  <span class="warn">-p</span>, <span class="warn">--project</span>           • Project name </span>
<span>  <span class="warn">-t</span>, <span class="warn">--target</span>            • Target environment </span>
<span></span>
<span class="bright">EXAMPLES </span>
<span style="opacity: 0.5">  # Deploy the "my-app" to the development environment </span>
<span>  $ my-cli deploy dev -p my-app </span>
</pre>   
</div>               

## Global Options

You can use the `cliHelpInterceptor` to automatically display command usage information when the `--help` option is used.
This interceptor also allows you to provide global command options that are available for all commands. 

Here's how to initialize Moost CLI with `cliHelpInterceptor` and define a default `--help` option:

```ts
import { MoostCli, cliHelpInterceptor } from '@moostjs/event-cli'
import { Moost } from 'moost'
import { CliController } from './cli.controller'

export function cli() {
    const app = new Moost()

    app.applyGlobalInterceptors(
        cliHelpInterceptor({  
            colors: true,
            lookupLevel: 3,
        })
    )
    app.registerControllers(CliController)
    app.adapter(new MoostCli({
        debug: true,
        wooksCli: {
            cliHelp: { name: 'moost-cli' },
        },
        globalCliOptions: [
            { keys: ['help'], description: 'Display instructions for the command.' }
        ]
    }))

    app.init()
}
```

In the example above, the `cliHelpInterceptor` is set up with `colors` and `lookupLevel` options,
the `CliController` is registered, and `MoostCli` adapter is initialized with the `debug` option,
a CLI name, and a global `--help` option.
This configuration helps improve the user experience of your CLI.

The `cliHelp: { name: 'moost-cli' },` line is used to specify the name of your CLI application.
This name is utilized when rendering CLI usage examples.
For instance, if you set the name to 'moost-cli', the command examples in your `--help` output will start with this name,
as in `$ moost-cli command path`.
By doing this, you can customize your CLI help messages and provide a more intuitive user experience that aligns with your application's identity.

These options provide an elegant way to build and maintain self-descriptive
command-line interfaces with Moost.
Whether you are building a small tool or a complex system,
a well-designed CLI is essential to create a seamless user experience.
