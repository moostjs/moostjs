import { getMoostMate } from 'moost'

export function Cli(path?: string): MethodDecorator {
    return getMoostMate().decorate('handlers', { path, type: 'CLI' }, true)
}
