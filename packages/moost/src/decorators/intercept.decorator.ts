import type { TCallableClassFunction } from '../class-function/types'
import type { TAny } from '../common-types'
import { getMoostMate } from '../metadata/moost-metadata'

export type TInterceptorBefore = (reply: (response: TAny) => void) => void | Promise<void>
export type TInterceptorAfter = (
  response: TAny,
  reply: (response: TAny) => void
) => void | Promise<void>
export type TInterceptorOnError = (
  error: Error,
  reply: (response: TAny) => void
) => void | Promise<void>
export interface TInterceptorFn {
  (
    before: (fn: TInterceptorBefore) => void,
    after: (fn: TInterceptorAfter) => void,
    onError: (fn: TInterceptorOnError) => void
  ): unknown | Promise<unknown>
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
 * Set interceptor
 * @param handler interceptor fn (use defineInterceptorFn)
 * @param priority interceptor priority
 * @returns
 */
export function Intercept(
  handler: TCallableClassFunction<TInterceptorFn>,
  priority?: TInterceptorPriority,
  name?: string
): ClassDecorator & MethodDecorator {
  return getMoostMate().decorate(
    'interceptors',
    {
      handler,
      priority:
        priority || (handler as TInterceptorFn).priority || TInterceptorPriority.INTERCEPTOR,
      name: name || (handler as TInterceptorFn)._name || handler.name,
    },
    true
  )
}
