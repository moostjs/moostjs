import { Wooks } from 'wooks'
import { useHttpContext } from '@wooksjs/event-http'
import { getMoostMate, TMoostMetadata } from '../metadata'
import { TObject } from 'common'

interface TStore {
    controller: TObject
    method: string | symbol
    pathBuilder: (opts?: Record<string, string | number>) => string
}

export function useControllerMeta<T extends TMoostMetadata = TMoostMetadata>() {
    const moostStore = useMoostStore()
    return {
        getClassMeta: () => getMoostMate().read<T>(moostStore.value.controller),
        getMethodMeta: () => getMoostMate().read<T>(moostStore.value.controller,moostStore.value.method),
    }
}

export function setComposableControllerContext(data: {
    controller: TObject,
    method: string | symbol,
    pathBuilder: ReturnType<Wooks['on']>,
}) {
    const moostStore = useMoostStore()
    moostStore.set('controller', data.controller)
    moostStore.set('method', data.method)
    moostStore.set('pathBuilder', data.pathBuilder)
}

function useMoostStore() {
    return useHttpContext<{ moost: TStore }>().store('moost')
}
