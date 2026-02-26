import { Cli, CliApp, Param } from '@moostjs/event-cli'
import { useAutoHelp, useCliOption } from '@wooksjs/event-cli'

import { getPrompts } from './prompts'
import { scaffold } from './scaffold'

class Commands extends CliApp {
  @Cli('')
  root() {
    return this.execute()
  }

  @Cli(':name')
  withName(@Param('name') name: string) {
    return this.execute(name)
  }

  async execute(name?: string) {
    if (useAutoHelp()) {
      process.exit(0)
    }

    const prompts = await getPrompts({
      name,
      http: !!useCliOption('http'),
      cli: !!useCliOption('cli'),
      ws: !!useCliOption('ws'),
      wf: !!useCliOption('wf'),
      oxc: !!useCliOption('oxc'),
      force: !!useCliOption('force'),
    })

    console.log('\nScaffolding a new project...')
    await scaffold(prompts)
    const cli = prompts.type === 'cli'
    const ws = prompts.type === 'ws'
    return `
${__DYE_WHITE_BRIGHT__ + __DYE_BOLD__}Success! ${__DYE_BOLD_OFF__}Your new "${
      prompts.projectName
    }" project has been created successfully. ${__DYE_COLOR_OFF__}

Follow these next steps to start your development server:

1. Navigate to your new project:
   ${__DYE_CYAN__}cd ${prompts.targetDir} ${__DYE_COLOR_OFF__}

2. Install the dependencies:
   ${__DYE_CYAN__}npm install ${__DYE_COLOR_OFF__}
${
  cli
    ? `
3. Make bin.js executable:
   ${__DYE_CYAN__}chmod +x ./bin.js ${__DYE_COLOR_OFF__}
`
    : ''
}
${cli ? '4' : '3'}. ${ws ? 'Build and start' : 'Start the development server'}:
   ${__DYE_CYAN__}npm run dev${cli ? ' -- hello World' : ''}${__DYE_COLOR_OFF__}

${__DYE_GREEN__}You're all set!${ws ? '' : ' The development server will help you in building your application.'}
Enjoy coding, and build something amazing!${__DYE_COLOR_OFF__}
`
  }
}

export function run() {
  new Commands()
    .useOptions([
      { keys: ['http'], description: 'Use Moost HTTP', type: Boolean },
      { keys: ['cli'], description: 'Use Moost CLI', type: Boolean },
      { keys: ['ws'], description: 'Use Moost WebSocket', type: Boolean },
      { keys: ['wf'], description: 'Add Workflow Adapter', type: Boolean },
      {
        keys: ['oxc'],
        description: 'Add OXC lint and formatter (oxlint + oxfmt)',
        type: Boolean,
      },
      { keys: ['force'], description: 'Force Overwrite', type: Boolean },
    ])
    .start()
}
