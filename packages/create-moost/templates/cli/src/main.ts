import { CliApp, Controller, Cli, Param } from '@moostjs/event-cli'

@Controller()
class Commands {
    @Cli('hello/:name')
    greet(@Param('name') name: string) {
        return `Hello, ${name}!`
    }
}

function run() {
  new CliApp()
    .controllers(Commands)
    .useHelp({ name: '{{ packageName }}'})
    .useOptions([{ keys: ['help'], description: 'Display instructions for the command.' }])
}

run()
