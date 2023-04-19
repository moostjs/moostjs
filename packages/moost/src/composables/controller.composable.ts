import { useEventContext } from '@wooksjs/event-core'
import { getMoostMate } from '../metadata'

interface TControllerContext<T> { controller: { instance: T, method: keyof T } }

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
    const getControllerMeta = () => getMoostMate().read(getController())
    const getMethodMeta = () => getMoostMate().read(getController(), getMethod() as string)

    return {
        getController,
        getMethod,
        getControllerMeta,
        getMethodMeta,
    }
}
