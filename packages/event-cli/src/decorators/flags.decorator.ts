import { useFlags } from '@wooksjs/event-cli'
import { Resolve } from 'moost'
import { getCliMate } from '../meta-types'

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

function formatParams(keys: string | [string, string] | [string]) {
    const names = [keys].flat()
    return names.map(n => n.length === 1 ? '-' + n : '--' + n)
}

export function CliParam(keys: string | [string, string], descr?: string) {
    const mate = getCliMate()
    return mate.apply(
        mate.decorate('cliParams', { keys, descr }, true),
        Resolve(() => {
            const flags = useFlags()
            const names = [keys].flat() as [string, string]
            const vals = []
            for (const name of names) {
                if (flags[name]) {
                    vals.push(flags[name])
                }
            }
            if (vals.length > 1) {
                throw new Error(`Options ${formatParams(names).join(' and ')} are synonyms. Please use only one of them.`)
            }
            if (vals.length === 0) {
                return false
            }
            return vals[0]
        }, formatParams(keys).join(', '))        
    )
}
