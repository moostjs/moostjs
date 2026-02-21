import type { TClassConstructor } from '../common-types'
import { getMoostMate } from '../metadata/moost-metadata'

/**
 * Marks a constructor parameter dependency as circular.
 * The resolver function is called lazily to break the circular reference.
 *
 * @param resolver - Factory that returns the class constructor (e.g. `() => MyService`).
 *
 * @example
 * ```ts
 * class ServiceA {
 *   constructor(@Circular(() => ServiceB) private b: ServiceB) {}
 * }
 * ```
 */
export function Circular<T = unknown>(resolver: () => TClassConstructor<T>): ParameterDecorator {
  return getMoostMate().decorate('circular', resolver)
}
