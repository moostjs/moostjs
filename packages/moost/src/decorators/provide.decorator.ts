import { createProvideRegistry, TProvideFn } from '@prostojs/infact'
import { getMoostMate } from '../metadata/moost-metadata'
import { TClassConstructor } from 'common'

/**
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
 * Defines a key from provide registry to inject value
 * (For optional values use with @Nullable())
 * @param type - string or class constructor
 */
export function Inject(type: string | TClassConstructor): ParameterDecorator {
    return getMoostMate().decorate('inject', type)
}

/**
 * Makes injectable value optional
 * @param value default true
 */
export function Nullable(v = true): ParameterDecorator {
    return getMoostMate().decorate('nullable', v)
}
