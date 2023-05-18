import { TClassFunction } from './class-function'
import { TInterceptorFn, TInterceptorPriority } from './decorators'
import { TPipeFn, TPipePriority } from './pipes'

export function defineInterceptorFn(fn: TInterceptorFn, priority: TInterceptorPriority = TInterceptorPriority.INTERCEPTOR) {
    fn.priority = priority
    return fn
}

export type TInterceptorClass = TClassFunction<TInterceptorFn>

export function definePipeFn(fn: TPipeFn, priority: TPipePriority = TPipePriority.TRANSFORM) {
    fn.priority = priority
    return fn
}
