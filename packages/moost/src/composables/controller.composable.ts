import { useAsyncEventContext } from '@wooksjs/event-core'
import type { TAny, TClassConstructor } from 'common'

import { getMoostInfact, getMoostMate } from '../metadata'

interface TControllerContext<T> {
  controller: { instance: T; method: keyof T }
}

export function setControllerContext<T>(controller: T, method: keyof T) {
  const { store } = useAsyncEventContext<TControllerContext<T>>()
  const { set } = store('controller')
  set('instance', controller)
  set('method', method)
}

export function useControllerContext<T extends object>() {
  const { store } = useAsyncEventContext<TControllerContext<T>>()
  const { get } = store('controller')

  const getController = () => get('instance')!
  const getMethod = () => get('method') as string | undefined
  // todo: add generic types to getControllerMeta
  const getControllerMeta = () => getMoostMate().read(getController())
  // todo: add generic types to getMethodMeta
  const getMethodMeta = (name?: string) => getMoostMate().read(getController(), name || getMethod())

  function instantiate<T>(c: TClassConstructor<T>) {
    return getMoostInfact().getForInstance(
      getController(),
      c as TClassConstructor<TAny>
    ) as Promise<T>
  }

  return {
    instantiate,
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
