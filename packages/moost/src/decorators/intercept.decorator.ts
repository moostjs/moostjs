import type { TAny, TClassConstructor } from '../common-types'
import { getMoostMate } from '../metadata/moost-metadata'

export type TInterceptorBeforeFn = (reply: (response: TAny) => void) => void | Promise<void>
/**
 * After hook: runs when the CURRENT value of the after/error chain is not an `Error`.
 * `response` is the handler result as replaced by the hooks that ran before this one;
 * `original` is the value that entered the chain. A throw, or a `reply()` with an `Error`,
 * switches the rest of the chain to error hooks.
 */
export type TInterceptorAfterFn = (
  response: TAny,
  reply: (response: TAny) => void,
  original?: TAny,
) => void | Promise<void>
/**
 * Error hook: runs when the CURRENT value of the after/error chain is an `Error` — raised by
 * the handler, a before hook, or an after/error hook that ran before this one. `original` is
 * the value that entered the chain. A `reply()` with a non-Error value recovers the chain.
 */
export type TInterceptorErrorFn = (
  error: Error,
  reply: (response: TAny) => void,
  original?: TAny,
) => void | Promise<void>

/**
 * Object-based interceptor definition.
 *
 * Declares lifecycle hooks directly instead of registering callbacks via init function.
 *
 * @example
 * ```ts
 * const myInterceptor: TInterceptorDef = {
 *   before(reply) {
 *     if (!isAuthenticated()) reply(new HttpError(401))
 *   },
 *   after(response, reply) {
 *     reply(transform(response))
 *   },
 *   error(error, reply, original) {
 *     reply(formatError(error))
 *   },
 * }
 * ```
 */
export interface TInterceptorDef {
  before?: TInterceptorBeforeFn
  after?: TInterceptorAfterFn
  error?: TInterceptorErrorFn
  priority?: TInterceptorPriority
  _name?: string
}

export enum TInterceptorPriority {
  BEFORE_ALL,

  BEFORE_GUARD,
  GUARD,
  AFTER_GUARD,

  INTERCEPTOR,

  CATCH_ERROR,

  AFTER_ALL,
}

/**
 * ## Intercept
 * ### @Decorator
 * Attach an interceptor to a class or method.
 * @param handler — @Interceptor class constructor or TInterceptorDef object
 * @param priority — interceptor priority (overrides handler's own priority)
 * @param name — interceptor name for tracing
 */
export function Intercept(
  handler: TClassConstructor | TInterceptorDef,
  priority?: TInterceptorPriority,
  name?: string,
): ClassDecorator & MethodDecorator {
  const mate = getMoostMate()
  if (typeof handler === 'function') {
    const interceptorMeta = mate.read(handler)
    return mate.decorate(
      'interceptors',
      {
        handler,
        priority:
          priority ?? interceptorMeta?.interceptor?.priority ?? TInterceptorPriority.INTERCEPTOR,
        name: name || handler.name || '<anonymous>',
      },
      true,
    )
  }
  return mate.decorate(
    'interceptors',
    {
      handler,
      priority: priority ?? handler.priority ?? TInterceptorPriority.INTERCEPTOR,
      name: name || handler._name || '<anonymous>',
    },
    true,
  )
}
