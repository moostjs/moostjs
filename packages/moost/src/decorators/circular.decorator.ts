import type { TClassConstructor } from '../common-types'
import { getMoostMate } from '../metadata/moost-metadata'

export function Circular<T = unknown>(resolver: () => TClassConstructor<T>): ParameterDecorator {
  return getMoostMate().decorate('circular', resolver)
}
