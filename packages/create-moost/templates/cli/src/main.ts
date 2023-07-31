import { MoostCli, cliHelpInterceptor } from '@moostjs/event-cli'
import { Moost } from 'moost'
import { AppController } from './controllers/app.controller'

function cli() {
    const app = new Moost()

    app.applyGlobalInterceptors(
        cliHelpInterceptor({
            colors: true,
            lookupLevel: 3,
        })
    )

    app.registerControllers(AppController)
    app.adapter(new MoostCli({
        debug: false,
        wooksCli: {
            cliHelp: { name: '{{ packageName }}' },
        },
        globalCliOptions: [
            { keys: ['help'], description: 'Display instructions for the command.', type: Boolean },
        ],
    }))

    void app.init()
}

cli()
