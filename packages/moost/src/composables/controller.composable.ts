import { useAsyncEventContext } from '@wooksjs/event-core'

import type { TAny, TClassConstructor } from '../common-types'
import { getMoostInfact, getMoostMate } from '../metadata'

interface TControllerContext<T> {
  controller: { instance: T; method: keyof T; route: string }
}

/**
 * Sets the controller context for the current event scope.
 * Called internally by adapters when dispatching events to handlers.
 */
export function setControllerContext<T>(controller: T, method: keyof T, route: string) {
  const { store } = useAsyncEventContext<TControllerContext<T>>()
  const { set } = store('controller')
  set('instance', controller)
  set('method', method)
  set('route', route)
}

/**
 * Provides access to the current controller context within an event handler.
 * Returns utilities for accessing the controller instance, method metadata, and DI.
 */
export function useControllerContext<T extends object>() {
  const { store } = useAsyncEventContext<TControllerContext<T>>()
  const { get } = store('controller')

  const getController = () => get('instance')!
  const getMethod = () => get('method') as string | undefined
  const getRoute = () => get('route')
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
