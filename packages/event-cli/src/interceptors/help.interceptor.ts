import { Intercept, TInterceptorPriority, defineInterceptorFn } from 'moost'
import { useCliContext, useFlag } from '@wooksjs/event-cli'
import { CliHelpRenderer } from '@prostojs/cli-help'

export const cliHelpInterceptor = (opts?: {
    helpOptions: string[]
}) => {
    return defineInterceptorFn(() => {
        const helpOptions = opts?.helpOptions || ['help']
        for (const option of helpOptions) {
            if (useFlag(option) === true) {
                const help = useCliContext<{ event: { cliHelp: CliHelpRenderer } }>().store('event').get('cliHelp')
                help.print(useCliContext().store('event').get('pathParams').join(' '), true)
                return ''
            }
        }
    }, TInterceptorPriority.BEFORE_ALL)
}

export const CliHelpInterceptor = (...opts: Parameters<typeof cliHelpInterceptor>) => Intercept(cliHelpInterceptor(...opts))
