import { CliApp, Controller, Cli, Param, CliExample, CliOption } from '@moostjs/event-cli'

@Controller()
class Commands {
    @CliExample('hello world', 'Prints "Hello, world!"')
    @CliExample('hello world -u', 'Prints "HELLO, WORLD!"')
    @Cli('hello/:name')
    greet(
        @Param('name') name: string,
        @CliOption('uppercase', 'u') uppercase: boolean,
    ) {
        const output = `Hello, ${name}!`
        return uppercase ? output.toUpperCase() : output
    }
}

function run() {
  new CliApp()
    .controllers(Commands)
    .useHelp({ name: '{{ packageName }}'})
    .useOptions([{ keys: ['help'], description: 'Display instructions for the command.' }])
    .start()
}

run()
