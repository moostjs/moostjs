import { useFlags } from '@wooksjs/event-cli'
import { Resolve } from 'moost'
import { getCliMate } from '../meta-types'
import { formatParams } from '../utils'

/**
 * Get Cli Flag
 * @decorator
 * @param name - flag name
 * @paramType string
 */
export function Flag(name: string) {
    return Resolve(() => useFlags()[name], name)
}

/**
 * Get Cli Flags
 * @decorator
 * @paramType object
 */
export function Flags() {
    return Resolve(() => useFlags(), 'flags')
}

export function CliParam(...keys: string[]): ParameterDecorator {
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
