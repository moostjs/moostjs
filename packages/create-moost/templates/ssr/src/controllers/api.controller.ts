import { Controller, Param } from 'moost'
import { Get } from '@moostjs/event-http'

@Controller('api')
export class ApiController {
  @Get('hello/:name')
  hello(@Param('name') name: string) {
    return { message: `Hello, ${name}!`, timestamp: Date.now() }
  }
}
