import { getMoostMate } from '../metadata/moost-metadata'
import { TClassConstructor } from '../types'

export function Circular<T = unknown>(resolver: () => TClassConstructor<T>): ParameterDecorator {
    return getMoostMate().decorate('circular', resolver)
}
