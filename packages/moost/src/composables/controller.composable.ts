import { useEventContext } from '@wooksjs/event-core'
import { getMoostInfact, getMoostMate } from '../metadata'
import { TAny, TClassConstructor } from 'common'

interface TControllerContext<T> {
    controller: { instance: T; method: keyof T }
}

export function setControllerContext<T>(controller: T, method: keyof T) {
    const { store } = useEventContext<TControllerContext<T>>()
    const { set } = store('controller')
    set('instance', controller)
    set('method', method)
}

export function useControllerContext<T extends object>() {
    const { store } = useEventContext<TControllerContext<T>>()
    const { get } = store('controller')

    const getController = () => get('instance')
    const getMethod = () => get('method')
    // todo: add generic types to getControllerMeta
    const getControllerMeta = () => getMoostMate().read(getController())
    // todo: add generic types to getMethodMeta
    const getMethodMeta = (name?: string) =>
        getMoostMate().read(getController(), name || getMethod() as string)

    function instantiate<T>(c: TClassConstructor<T>) {
        return getMoostInfact().getForInstance(getController(), c as TClassConstructor<TAny>) as Promise<T>
    }

    return {
        instantiate, 
        getController,
        getMethod,
        getControllerMeta,
        getMethodMeta,
        getPropertiesList: () => getControllerMeta()?.properties || [],
        getScope: () => getControllerMeta()?.injectable || 'SINGLETON',
        getParamsMeta: () => getControllerMeta()?.params || [],
        getPropMeta: (name: string) => getMethodMeta(name),
    }
}
