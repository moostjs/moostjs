import { TInterceptorFn } from '@moostjs/moost'
import { useFlags } from '@wooksjs/event-cli'

export function helpInterceptor(): TInterceptorFn {
    return (before) => {
        const flags = useFlags()
        if (flags.help || flags.h) {
            before((reply) => {
                reply('help requested')
            })
        }
    }
}
