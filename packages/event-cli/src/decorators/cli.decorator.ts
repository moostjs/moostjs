import { getCliMate } from '../meta-types'

export function Cli(path?: string): MethodDecorator {
    return getCliMate().decorate('handlers', { path, type: 'CLI' }, true)
}
