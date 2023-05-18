import { Intercept, TInterceptorPriority, defineInterceptorFn, useControllerContext } from 'moost'
import { useCliContext, useFlag } from '@wooksjs/event-cli'
import { useCliHelp } from '../composables'

/**
 * ### Interceptor Factory for CliHelpRenderer
 * 
 * By default intercepts cli calls with flag --help
 * and prints help.
 * 
 * ```js
 * new Moost().applyGlobalInterceptors(cliHelpInterceptor({ colors: true }))
 * ```
 * @param opts {} { helpOptions: ['help', 'h'], colors: true } cli options to invoke help renderer
 * @returns TInterceptorFn
 */
export const cliHelpInterceptor = (opts?: {
    /**
     * CLI Options that invoke help
     * ```js
     * helpOptions: ['help', 'h']
     * ```
     */
    helpOptions?: string[]
    /**
     * Enable colored help
     */
    colors?: boolean
    /**
     * Enable help message when arguments are missing
     */
    helpWithArgs?: boolean
    /**
     * Enable help message when command is incomplete
     * and it is possible to suggest related commands
     */
    helpWithIncompleteCmd?: boolean
}) => {
    return defineInterceptorFn(() => {
        const helpOptions = opts?.helpOptions || ['help']
        for (const option of helpOptions) {
            if (useFlag(option) === true) {
                try {
                    useCliHelp().print(opts?.colors)
                    return ''
                } catch (e) {
                    //
                }
            }
        }
        if (opts?.helpWithArgs || opts?.helpWithIncompleteCmd) {
            const { getMethod } = useControllerContext()
            if (!getMethod()) {
                const parts = useCliContext().store('event').get('pathParams')
                const cliHelp = useCliHelp().getCliHelp()
                const cmd = cliHelp.getCliName()
                let data
                for (let i = 0; i < Math.min(parts.length, 4); i++) {
                    const pathParams = parts.slice(0, i ? -i : parts.length).join(' ')
                    try {
                        data = cliHelp.match(pathParams)
                        break
                    } catch (e) {
                        if (opts?.helpWithIncompleteCmd) {
                            const variants = cliHelp.lookup(pathParams)
                            if (variants.length) {
                                throw new Error(`Wrong command, did you mean:\n${variants.slice(0, 7).map(c => `  $ ${cmd} ${c.main.command}`).join('\n')}`)
                            }
                        }
                    }
                }
                if (data) {
                    const { main, children } = data
                    if (opts?.helpWithArgs && main.args && Object.keys(main.args).length) {
                        throw new Error(`Arguments expected: ${Object.keys(main.args).map(l => `<${l}>`).join(', ')}`)
                    } else if (opts?.helpWithIncompleteCmd && children && children.length) {
                        throw new Error(`Wrong command, did you mean:\n${children.slice(0, 7).map(c => `  $ ${ cmd } ${ c.command }`).join('\n')}`)
                    }
                }
            }            
        }
    }, TInterceptorPriority.BEFORE_ALL)
}

/**
 * ## @Decorator 
 * ### Interceptor Factory for CliHelpRenderer
 * 
 * By default intercepts cli calls with flag --help
 * and prints help.
 * 
 * ```ts
 * // default configuration
 * • @CliHelpInterceptor({ helpOptions: 'help', colors: true })
 * 
 * // additional option -h to invoke help renderer 
 * • @CliHelpInterceptor({ helpOptions: ['help', 'h'], colors: true })
 * 
 * // redefine cli option to invoke help renderer
 * • @CliHelpInterceptor({ helpOptions: ['usage'] })
 * ```
 * 
 * @param opts {} { helpOptions: ['help', 'h'], colors: true } cli options to invoke help renderer
 * @returns Decorator
 */
export const CliHelpInterceptor = (...opts: Parameters<typeof cliHelpInterceptor>) => Intercept(cliHelpInterceptor(...opts))
