import type { TProvideFn } from '@prostojs/infact'
import { createProvideRegistry } from '@prostojs/infact'
import type { TClassConstructor } from 'common'

import { getMoostMate } from '../metadata/moost-metadata'

/**
 * ## Provide
 * ### @Decorator
 * Defines provide registry for class (and all the children)
 * @param type - string or class constructor
 * @param fn - factory function for provided value
 */
export function Provide(type: string | TClassConstructor, fn: TProvideFn): ClassDecorator {
  return getMoostMate().decorate(meta => {
    meta.provide = meta.provide || {}
    Object.assign(meta.provide, createProvideRegistry([type, fn]))
    return meta
  })
}

/**
 * ## Inject
 * ### @Decorator
 * Defines a key from provide registry to inject value
 * (For optional values use with @Optional())
 * @param type - string or class constructor
 */
export function Inject(type: string | TClassConstructor): ParameterDecorator {
  return getMoostMate().decorate('inject', type)
}
