import { CliHelpRenderer } from '@prostojs/cli-help'
import { useCliContext } from '@wooksjs/event-cli'

/**
 * ### setCliHelpForEvent
 * Used internally to set CliHelpRenderer instance for an event state
 * @param cliHelp CliHelpRenderer
 */
export function setCliHelpForEvent(cliHelp: CliHelpRenderer) {
    useCliContext<{ event: { cliHelp: CliHelpRenderer } }>().store('event').set('cliHelp', cliHelp)
}

/**
 * ## useCliHelp
 * ### Composable
 * ```js
 * // example of printing cli instructions
 * const { print } = useCliHelp()
 * print(true)
 * ```
 * @returns 
 */
export function useCliHelp() {
    const event = useCliContext<{ event: { cliHelp: CliHelpRenderer } }>().store('event')
    const getCliHelp = () => event.get('cliHelp')
    return {
        getCliHelp,
        render: (width?: number, withColors?: boolean) => getCliHelp().render(event.get('pathParams').join(' '), width, withColors),
        print: (withColors?: boolean) => getCliHelp().print(event.get('pathParams').join(' '), withColors),
    }
}
