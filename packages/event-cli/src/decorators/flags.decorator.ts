import { useFlags } from '@wooksjs/event-cli'
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
