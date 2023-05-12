import { TCallableClassFunction } from '../class-function/types'
import { getMoostMate } from '../metadata/moost-metadata'
import { TAny } from 'common'

export type TInterceptorBefore = (
    reply: (response: TAny) => void
) => void | Promise<void>
export type TInterceptorAfter = (
    response: TAny,
    reply: (response: TAny) => void
) => void | Promise<void>
export type TInterceptorOnError = (
    error: Error,
    reply: (response: TAny) => void
) => void | Promise<void>
export type TInterceptorFn = {
    (
        before: (fn: TInterceptorBefore) => void,
        after: (fn: TInterceptorAfter) => void,
        onError: (fn: TInterceptorOnError) => void
    ): void | Promise<void>
    priority?: TInterceptorPriority
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

export function Intercept(
    handler: TCallableClassFunction<TInterceptorFn>,
    priority?: TInterceptorPriority
): ClassDecorator & MethodDecorator {
    return getMoostMate().decorate(
        'interceptors',
        {
            handler,
            priority:
                priority ||
                (handler as TInterceptorFn).priority ||
                TInterceptorPriority.INTERCEPTOR,
        },
        true
    )
}
