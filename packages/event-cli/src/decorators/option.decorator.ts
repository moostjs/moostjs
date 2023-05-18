import { useFlags } from '@wooksjs/event-cli'
import { Resolve } from 'moost'
import { getCliMate } from '../meta-types'
import { formatParams } from '../utils'

/**
 * ## Define CLI Option
 * ### @ParameterDecorator
 * Use together with @Description('...') to document cli option
 * 
 * ```ts
 * │   @Cli('command')
 * │   command(
 * │      @Description('Test flag...')
 * │      @CliOption('test', 't')
 * │      test: boolean,
 * │   ) {
 * │       return `test=${ test }`
 * │   }
 * ```
 * 
 * @param keys list of keys (short and long alternatives)
 * @returns 
 */
export function CliOption(...keys: string[]): ParameterDecorator {
    const mate = getCliMate()
    return mate.apply(
        mate.decorate('cliParamKeys', keys, false),
        Resolve(() => {
            const flags = useFlags()
            const names = keys
            const vals = []
            for (const name of names) {
                if (flags[name]) {
                    vals.push(flags[name])
                }
            }
            if (vals.length > 1) {
                throw new Error(
                    `Options ${formatParams(names).join(
                        ' and '
                    )} are synonyms. Please use only one of them.`
                )
            }
            if (vals.length === 0) {
                return false
            }
            return vals[0]
        }, formatParams(keys).join(', '))
    )
}
