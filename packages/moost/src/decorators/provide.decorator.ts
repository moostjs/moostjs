import { createProvideRegistry, TProvideFn } from '@prostojs/infact'
import { getMoostMate } from '../metadata/moost-metadata'
import { TClassConstructor } from '../types'

export function Provide(type: string | TClassConstructor, fn: TProvideFn): ClassDecorator {
    return getMoostMate().decorate(meta => {
        meta.provide = meta.provide || {}
        Object.assign(meta.provide, createProvideRegistry([type, fn]))
        return meta
    })
}

export function Inject(type: string | TClassConstructor): ParameterDecorator {
    return getMoostMate().decorate('inject', type)
}
