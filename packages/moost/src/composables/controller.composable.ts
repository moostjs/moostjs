import type { EventContext } from '@wooksjs/event-core'
import { current, key } from '@wooksjs/event-core'

import type { TAny, TClassConstructor } from '../common-types'
import { getMoostInfact, getMoostMate } from '../metadata'

const controllerInstanceKey = key<unknown>('controller.instance')
const controllerMethodKey = key<string>('controller.method')
const controllerRouteKey = key<string>('controller.route')

/**
 * Sets the controller context for the current event scope.
 * Called internally by adapters when dispatching events to handlers.
 */
export function setControllerContext<T>(
  controller: T,
  method: keyof T,
  route: string,
  ctx?: EventContext,
) {
  const _ctx = ctx || current()
  _ctx.set(controllerInstanceKey, controller)
  _ctx.set(controllerMethodKey, method as string)
  _ctx.set(controllerRouteKey, route)
}

/**
 * Provides access to the current controller context within an event handler.
 * Returns utilities for accessing the controller instance, method metadata, and DI.
 */
export function useControllerContext<T extends object>(ctx?: EventContext) {
  const _ctx = ctx || current()

  const getController = () => _ctx.get(controllerInstanceKey) as T
  const getMethod = () => _ctx.get(controllerMethodKey) as string | undefined
  const getRoute = () => _ctx.get(controllerRouteKey)
  // todo: add generic types to getControllerMeta
  const getControllerMeta = <TT extends object>() =>
    getMoostMate<TT, TT, TT>().read(getController())
  // todo: add generic types to getMethodMeta
  const getMethodMeta = <TT extends object>(name?: string) =>
    getMoostMate<TT, TT, TT>().read(getController(), name || getMethod())

  function instantiate<TT>(c: TClassConstructor<TT>) {
    return getMoostInfact().getForInstance(
      getController(),
      c as TClassConstructor<TAny>,
    ) as Promise<TT>
  }

  return {
    instantiate,
    getRoute,
    getController,
    getMethod,
    getControllerMeta,
    getMethodMeta,
    getPropertiesList: () => getControllerMeta()?.properties || [],
    getScope: () => getControllerMeta()?.injectable || 'SINGLETON',
    getParamsMeta: () => getMethodMeta()?.params || [],
    getPropMeta: (name: string) => getMethodMeta(name),
  }
}
