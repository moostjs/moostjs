import type { TProvideFn } from '@prostojs/infact'
import { createProvideRegistry, createReplaceRegistry } from '@prostojs/infact'
import type { TClassConstructor } from 'common'

import { getInfactScopeVars } from '../metadata'
import { getMoostMate } from '../metadata/moost-metadata'
import { Resolve } from './resolve.decorator'

/**
 * ## Provide
 * ### @Decorator
 * Defines provide registry for class (and all the children)
 * @param type - string or class constructor
 * @param fn - factory function for provided value
 */
export function Provide(
  type: string | TClassConstructor,
  fn: TProvideFn
): ClassDecorator & ParameterDecorator & PropertyDecorator {
  return getMoostMate().decorate(meta => {
    meta.provide = meta.provide || {}
    Object.assign(meta.provide, createProvideRegistry([type, fn]))
    return meta
  })
}

/**
 * ## Replace
 * ### @Decorator
 * Defines class to replace in DI
 * @param type - class to replace
 * @param newType - new class
 */
export function Replace(type: TClassConstructor, newType: TClassConstructor): ClassDecorator {
  return getMoostMate().decorate(meta => {
    meta.replace = meta.replace || {}
    Object.assign(meta.replace, createReplaceRegistry([type, newType]))
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
export function Inject(type: string | TClassConstructor): ParameterDecorator & PropertyDecorator {
  return getMoostMate().decorate('inject', type)
}

/**
 * Injects instance from scope
 *
 * (scope must be defined by `defineInfactScope` fn)
 * @param name scope name
 */
export function InjectFromScope(name: string | symbol): ParameterDecorator & PropertyDecorator {
  return getMoostMate().decorate('fromScope', name)
}
/**
 * Inject vars from scope for instances
 * instantiated with `@InjectFromScope` decorator
 */
export function InjectScopeVars(name?: string): ParameterDecorator & PropertyDecorator {
  return Resolve(({ scopeId }) => {
    if (scopeId) {
      return name
        ? getInfactScopeVars<Record<string, unknown>>(scopeId)?.[name]
        : getInfactScopeVars(scopeId)
    }
    return undefined
  })
}
