import { MoostHttp } from '@moostjs/event-http'
import { Moost } from 'moost'
import { AppController } from './controllers/app.controller'

const app = new Moost()

void app.adapter(new MoostHttp()).listen(3000, () => {
    app.getLogger('{{ projectName }}').info('Up on port 3000')
})

void app
    .registerControllers(
        AppController
        // Add more controllers here...
    )
    .init()
