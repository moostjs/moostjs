/* eslint-disable complexity */
import { HttpError } from '@wooksjs/event-http'
import {
  defineInterceptorFn,
  Intercept,
  Resolve,
  TInterceptorPriority,
  useEventLogger,
} from 'moost'

import { useArbac } from './arbac.composables'
import { getArbacMate } from './arbac.mate'

/**
 * Interceptor function that enforces authorization checks based on ARBAC rules.
 * It evaluates the user's permissions against the requested resource and action.
 *
 * @constant
 */
export const arbackAuthorizeInterceptor = defineInterceptorFn(async (before, after, onError) => {
  const logger = useEventLogger('arbac')

  const { setScopes, evaluate, resource, action, isPublic } = useArbac<any>()

  if (!action || !resource || isPublic) {
    return
  }

  try {
    const { allowed, scopes, userId } = await evaluate({ resource, action })
    logger.debug(`[${userId}] ${allowed ? 'Authorized' : 'Blocked'} "${resource}" : "${action}"`)
    if (!allowed) {
      throw new HttpError(
        403,
        `Insufficient privileges for action "${action}" on resource "${resource}"`
      )
    }
    setScopes(scopes)
  } catch (error) {
    if (error instanceof HttpError) {
      throw error
    }
    logger.warn(error)
    throw new HttpError(401, `Authorization error`)
  }
}, TInterceptorPriority.GUARD)

/**
 * Decorator that applies the `arbackAuthorizeInterceptor` to enforce authorization.
 *
 * @returns {MethodDecorator} A method decorator that enforces ARBAC.
 */
export const ArbacAuthorize = () => Intercept(arbackAuthorizeInterceptor)

/**
 * Resolves and retrieves the current ARBAC scopes in the request context.
 *
 * @returns {Function} A resolver function that returns user access scopes.
 */
export const ArbacScopes = () => Resolve(() => useArbac().getScopes())

/**
 * Decorator to specify a resource for ARBAC evaluation.
 *
 * @param {string} name - The name of the resource.
 * @returns {PropertyDecorator} A property decorator for ARBAC resource identification.
 */
export const ArbacResource = (name: string) => getArbacMate().decorate('arbacResourceId', name)

/**
 * Decorator to specify an action for ARBAC evaluation.
 *
 * @param {string} name - The name of the action.
 * @returns {PropertyDecorator} A property decorator for ARBAC action identification.
 */
export const ArbacAction = (name: string) => getArbacMate().decorate('arbacActionId', name)

/**
 * Marks a resource or action as publicly accessible, bypassing authorization checks.
 *
 * @returns {PropertyDecorator} A property decorator that marks an entity as public.
 */
export const ArbacPublic = () => getArbacMate().decorate('arbacPublic', true)
