import { Cli } from '@moostjs/event-cli'
import { Controller, Param } from 'moost'

@Controller()
export class AppController {
    @Cli('hello/:name')
    greet(@Param('name') name: string) {
        return `Hello, ${name}!`
    }
}
