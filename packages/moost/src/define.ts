import type { TEmpty, TObject } from './common-types'
import type {
  TInterceptorAfterFn,
  TInterceptorBeforeFn,
  TInterceptorDef,
  TInterceptorErrorFn,
} from './decorators'
import { TInterceptorPriority } from './decorators'
import type { TPipeFn } from './pipes'
import { TPipePriority } from './pipes'

/**
 * Define a before-phase interceptor.
 *
 * Runs before argument resolution and handler execution.
 * Call `reply(value)` to short-circuit the handler and respond early.
 *
 * @example
 * ```ts
 * const authGuard = defineBeforeInterceptor((reply) => {
 *   if (!isAuthenticated()) reply(new HttpError(401))
 * }, TInterceptorPriority.GUARD)
 * ```
 */
export function defineBeforeInterceptor(
  fn: TInterceptorBeforeFn,
  priority: TInterceptorPriority = TInterceptorPriority.INTERCEPTOR,
): TInterceptorDef {
  return { before: fn, priority }
}

/**
 * Define an after-phase interceptor.
 *
 * Runs after successful handler execution.
 * Call `reply(value)` to transform/replace the response.
 *
 * @example
 * ```ts
 * const setHeader = defineAfterInterceptor(() => {
 *   useResponse().setHeader('x-server', 'my-server')
 * }, TInterceptorPriority.AFTER_ALL)
 * ```
 */
export function defineAfterInterceptor(
  fn: TInterceptorAfterFn,
  priority: TInterceptorPriority = TInterceptorPriority.AFTER_ALL,
): TInterceptorDef {
  return { after: fn, priority }
}

/**
 * Define an error-phase interceptor.
 *
 * Runs when the handler throws or returns an Error.
 * Call `reply(value)` to recover from the error with a replacement response.
 *
 * @example
 * ```ts
 * const errorFormatter = defineErrorInterceptor((error, reply) => {
 *   reply({ message: error.message, status: 500 })
 * }, TInterceptorPriority.CATCH_ERROR)
 * ```
 */
export function defineErrorInterceptor(
  fn: TInterceptorErrorFn,
  priority: TInterceptorPriority = TInterceptorPriority.CATCH_ERROR,
): TInterceptorDef {
  return { error: fn, priority }
}

/**
 * Define a full interceptor with multiple lifecycle hooks.
 *
 * @example
 * ```ts
 * const myInterceptor = defineInterceptor({
 *   before(reply) { ... },
 *   after(response, reply) { ... },
 *   error(error, reply) { ... },
 * }, TInterceptorPriority.INTERCEPTOR)
 * ```
 */
export function defineInterceptor(
  def: TInterceptorDef,
  priority: TInterceptorPriority = TInterceptorPriority.INTERCEPTOR,
): TInterceptorDef {
  def.priority = priority
  return def
}

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
 * @param fn pipe function
 * @param priority priority of the pipe
 * @returns
 */
export function definePipeFn<T extends TObject = TEmpty>(
  fn: TPipeFn<T>,
  priority: TPipePriority = TPipePriority.TRANSFORM,
) {
  fn.priority = priority
  return fn
}
