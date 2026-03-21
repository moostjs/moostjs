import { Moost } from 'moost'
import { MoostHttp } from '@moostjs/event-http'
import { ApiController } from './controllers/api.controller'

const app = new Moost()
app.adapter(new MoostHttp()).listen(3000)
app.registerControllers(ApiController)
app.init()
