import type { TEmpty, TFunction, TObject, TClassConstructor } from '../common-types'
import type { TDecoratorLevel } from '../decorators/types'
import type { TMoostMetadata, TMoostParamsMetadata } from '../metadata'

/** Metadata context passed to pipe functions during argument/property resolution. */
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
  instantiate: <T extends TObject>(t: TClassConstructor<T>) => Promise<T>
}

/** A pipe function that transforms, resolves, or validates a value during the pipe pipeline. */
export interface TPipeFn<T extends TObject = TEmpty> {
  (value: unknown, metas: TPipeMetas<T>, level: TDecoratorLevel): unknown | Promise<unknown>
  priority?: TPipePriority
}

/** Execution priority for pipes. Lower values run first. */
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

/** A pipe entry pairing a handler function with its execution priority. */
export interface TPipeData {
  handler: TPipeFn
  priority: TPipePriority
}
