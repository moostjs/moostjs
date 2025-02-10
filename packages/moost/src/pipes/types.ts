import type { TEmpty, TFunction, TObject } from '../common-types'
import type { TDecoratorLevel } from '../decorators/types'
import type { TMoostMetadata, TMoostParamsMetadata } from '../metadata'

export interface TPipeMetas<T extends TObject = TEmpty> {
  classMeta?: TMoostMetadata & T
  methodMeta?: TMoostMetadata & T
  propMeta?: TMoostMetadata & T
  paramMeta?: TMoostParamsMetadata & T
  targetMeta?: TMoostParamsMetadata & T
  instance?: TObject
  scopeId?: string | symbol
  type: TFunction
  index?: number
  key: string | symbol
}

export interface TPipeFn<T extends TObject = TEmpty> {
  (value: unknown, metas: TPipeMetas<T>, level: TDecoratorLevel): unknown | Promise<unknown>
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
