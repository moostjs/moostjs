import { Get } from '@moostjs/event-http'
import { Controller, Param } from 'moost'

@Controller()
export class AppController {
    @Get('hello/:name')
    greet(@Param('name') name: string) {
        return `Hello, ${name}!`
    }
}
