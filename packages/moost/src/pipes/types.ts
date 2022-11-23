import { TMoostParamsMetadata } from '../metadata'

export type TPipeFn<T extends TMoostParamsMetadata = TMoostParamsMetadata> 
    = {
        (value: unknown, meta: T): unknown | Promise<unknown>
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
