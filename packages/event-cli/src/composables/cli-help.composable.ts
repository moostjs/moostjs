import { useCliContext } from '@wooksjs/event-cli'
import { CliHelpRendererWithFn } from '../meta-types'

/**
 * ### setCliHelpForEvent
 * Used internally to set CliHelpRenderer instance for an event state
 * @param cliHelp CliHelpRenderer
 */
export function setCliHelpForEvent(cliHelp: CliHelpRendererWithFn) {
    useCliContext<{ event: { cliHelp: CliHelpRendererWithFn } }>().store('event').set('cliHelp', cliHelp)
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
    const event = useCliContext<{ event: { cliHelp: CliHelpRendererWithFn } }>().store('event')
    const getCliHelp = () => event.get('cliHelp')
    return {
        getCliHelp,
        render: (width?: number, withColors?: boolean) => getCliHelp().render(event.get('pathParams').join(' '), width, withColors),
        print: (withColors?: boolean) => getCliHelp().print(event.get('pathParams').join(' '), withColors),
    }
}
