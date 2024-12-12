import type { TEmpty, TObject } from 'common'

import type { TClassFunction } from './class-function'
import type { TInterceptorFn } from './decorators'
import { TInterceptorPriority } from './decorators'
import type { TPipeFn } from './pipes'
import { TPipePriority } from './pipes'

/**
 * ### Define Interceptor Function
 *
 * ```ts
 * defineInterceptorFn((before, after, onError) => {
 *         //init
 *         before(() => {
 *              // before handler
 *         })
 *         after((response, reply) => {
 *              // after handler
 *         })
 *         onError((error, reply) => {
 *              // when error occured
 *         })
 *     },
 *     TInterceptorPriority.INTERCEPTOR,
 * )
 * ```
 *
 * @param fn interceptor function
 * @param priority priority of the interceptor where BEFORE_ALL = 0, BEFORE_GUARD = 1, GUARD = 2, AFTER_GUARD = 3, INTERCEPTOR = 4, CATCH_ERROR = 5, AFTER_ALL = 6
 * @returns
 */
export function defineInterceptorFn(
  fn: TInterceptorFn,
  priority: TInterceptorPriority = TInterceptorPriority.INTERCEPTOR
) {
  fn.priority = priority
  return fn
}

/**
 * Class based interceptor interface
 *
 * Use it to create class-based interceptors and don't forget to make it **@Injectable()**
 *
 * @example
 * "@Injectable()
 * export class MyInterceptor implements TInterceptorClass {
 *     static priority = TInterceptorPriority.INTERCEPTOR
 *     handler: TInterceptorClass['handler'] = (before, after, onError) => {
 *         before((reply) => {
 *             console.log('before')
 *         })
 *         after((response, reply) => {
 *             console.log('after')
 *         })
 *         onError((error, reply) => {
 *             console.log('error')
 *         })
 *     }
 * }
 */
export type TInterceptorClass = TClassFunction<TInterceptorFn>

/**
 * ### Define Pipe Function
 *
 * ```ts
 * // example of a transform pipe
 * const uppercaseTransformPipe = definePipeFn((value, metas, level) => {
 *         return typeof value === 'string' ? value.toUpperCase() : value
 *     },
 *     TPipePriority.TRANSFORM,
 * )
 * ```
 *
 * @param fn interceptor function
 * @param priority priority of the pipe where BEFORE_RESOLVE = 0, RESOLVE = 1, AFTER_RESOLVE = 2, BEFORE_TRANSFORM = 3, TRANSFORM = 4, AFTER_TRANSFORM = 5, BEFORE_VALIDATE = 6, VALIDATE = 7, AFTER_VALIDATE = 8
 * @returns
 */
export function definePipeFn<T extends TObject = TEmpty>(
  fn: TPipeFn<T>,
  priority: TPipePriority = TPipePriority.TRANSFORM
) {
  fn.priority = priority
  return fn
}
