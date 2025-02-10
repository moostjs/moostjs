import { CliApp, Controller, Cli, Param, CliExample, CliOption, Description } from '@moostjs/event-cli'

@Controller()
class Commands {
    @Description('Prints a greeting')
    @CliExample('hello world', 'Prints "Hello, world!"')
    @CliExample('hello world -u', 'Prints "HELLO, WORLD!"')
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

/**
 * npm run dev hello world
 */
function run() {
  new CliApp()
    .controllers(Commands)
    .useHelp({ name: '{{ packageName }}', title: ''})
    .useOptions([{ keys: ['help'], description: 'Display instructions for the command.' }])
    .start()
}

run()
