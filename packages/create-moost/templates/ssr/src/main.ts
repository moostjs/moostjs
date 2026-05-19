import { Moost } from 'moost'
import { MoostHttp } from '@moostjs/event-http'
import { ApiController } from './controllers/api.controller'

const app = new Moost()
app.registerControllers(ApiController)
await app.adapter(new MoostHttp()).listen(3000)
await app.init()
