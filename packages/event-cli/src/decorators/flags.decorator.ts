import { useFlags } from '@wooksjs/event-cli'
import { panic } from 'common'
import { Resolve } from 'moost'

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

export function CliParam(keys: string | [string, string], descr?: string) {
    return Resolve<TCliMeta>(() => {
        const flags = useFlags()
        const names = [keys].flat()
        const vals = []
        for (const name of names) {
            if (flags[name]) {
                vals.push(flags[name])
            }
        }
        if (vals.length > 1) {
            throw panic(`Options ${names.map(n => n.length === 1 ? '-' + n : '--' + n).join(' and ')} are synonyms. Please use only one of them.`)
        }
        if (vals.length === 0) {
            return false
        }
        return vals[0]
    })
}

interface TCliMeta {
    cliParams: {
        keys: string[]
        name: string
        descr?: string
    }[]
}
