import { useInterceptResult, useOvertake } from '../composables/interceptor.composable'
import type { TInterceptorDef } from './intercept.decorator'
import { TInterceptorPriority } from './intercept.decorator'
import type { TInjectableScope } from '../metadata/moost-metadata'
import { getMoostMate } from '../metadata/moost-metadata'
import { insureInjectable } from './injectable.decorator'
import { Resolve } from './resolve.decorator'

export type { TOvertakeFn } from '../composables/interceptor.composable'
export type TInterceptorDefFactory = () => TInterceptorDef | Promise<TInterceptorDef>

/**
 * ## @Interceptor
 * ### Class Decorator
 * Marks a class as a decorator-based interceptor.
 * Auto-adds @Injectable() if not already present.
 *
 * Use @Before(), @After(), and @OnError() method decorators
 * to register lifecycle hooks.
 *
 * @param priority — interceptor priority (default: INTERCEPTOR)
 * @param scope — DI scope ('FOR_EVENT' | 'SINGLETON' | true)
 */
export function Interceptor(
  priority?: TInterceptorPriority,
  scope?: true | TInjectableScope,
): ClassDecorator {
  const mate = getMoostMate()
  const decorators = [
    insureInjectable,
    mate.decorate('interceptor', { priority: priority ?? TInterceptorPriority.INTERCEPTOR }),
  ]
  if (scope) {
    decorators.push(mate.decorate('injectable', scope))
  }
  return mate.apply(...decorators)
}

/**
 * ## @Before
 * ### Method Decorator
 * Marks a method as a before-phase interceptor hook.
 * Runs before argument resolution and handler execution.
 * Use @Overtake() param to get the reply fn for short-circuiting.
 */
export function Before(): MethodDecorator {
  return getMoostMate().decorate('interceptorHook', 'before')
}

/**
 * ## @After
 * ### Method Decorator
 * Marks a method as an after-phase interceptor hook.
 * Runs after successful handler execution.
 * Use @Response() param for the handler result, @Overtake() for the reply fn.
 */
export function After(): MethodDecorator {
  return getMoostMate().decorate('interceptorHook', 'after')
}

/**
 * ## @OnError
 * ### Method Decorator
 * Marks a method as an error-phase interceptor hook.
 * Runs when the handler throws or returns an Error.
 * Use @Response() param for the error, @Overtake() for the reply fn.
 */
export function OnError(): MethodDecorator {
  return getMoostMate().decorate('interceptorHook', 'error')
}

/**
 * ## @Overtake
 * ### Parameter Decorator
 * Injects the reply function into an interceptor method parameter.
 * Call the reply fn to short-circuit the handler or replace the response.
 */
export function Overtake(): ParameterDecorator {
  return Resolve(() => useOvertake(), 'overtake') as ParameterDecorator
}

/**
 * ## @Response
 * ### Parameter Decorator
 * Injects the handler result into an interceptor method parameter.
 * In @After methods, this is the successful response.
 * In @OnError methods, this is the Error that was thrown.
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
export function Response(): ParameterDecorator {
  return Resolve(() => useInterceptResult(), 'response') as ParameterDecorator
}
