import { TDecoratorLevel } from '../decorators/types'
import { TMoostMetadata, TMoostParamsMetadata } from '../metadata'
import { TEmpty, TObject } from 'common'

export interface TPipeMetas<T extends TObject = TEmpty> {
    classMeta?: TMoostMetadata & T
    methodMeta?: TMoostMetadata & T
    propMeta?: TMoostMetadata & T
    paramMeta?: TMoostParamsMetadata & T
    instance?: TObject
    key?: string | symbol
}

export type TPipeFn<T extends TObject = TEmpty> = {
    (value: unknown, metas: TPipeMetas<T>, level: TDecoratorLevel):
        | unknown
        | Promise<unknown>
    priority?: TPipePriority
}

export enum TPipePriority {
    BEFORE_RESOLVE,
    RESOLVE,
    AFTER_RESOLVE,

    BEFORE_TRANSFORM,
    TRANSFORM,
    AFTER_TRANSFORM,

    BEFORE_VALIDATE,
    VALIDATE,
    AFTER_VALIDATE,
}

export interface TPipeData {
    handler: TPipeFn
    priority: TPipePriority
}
