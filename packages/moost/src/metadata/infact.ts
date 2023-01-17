import { Infact, TInfactClassMeta } from '@prostojs/infact'
import { runPipes } from '../pipes/run-pipes'
import { getMoostMate, TMoostMetadata, TMoostParamsMetadata } from './moost-metadata'
import { useEventId } from '@wooksjs/event-core'
import { TPipeData } from '../pipes'

const sharedMoostInfact = getNewMoostInfact()

export function getMoostInfact() {
    return sharedMoostInfact
}

interface TCustom {
    pipes?: TPipeData[]
}

export function getNewMoostInfact() {
    return new Infact<TMoostMetadata, TMoostMetadata, TMoostParamsMetadata, TCustom>({
        describeClass(classConstructor) {
            const meta = getMoostMate().read(classConstructor)
            const infactMeta = {
                injectable: !!meta?.injectable,
                global: false,
                constructorParams: meta?.params || [],
                provide: meta?.provide,
                properties: meta?.properties || [],
                scopeId: meta?.injectable === 'FOR_EVENT' ? useEventId().getId() : undefined,
            } as unknown as TInfactClassMeta<TMoostParamsMetadata> & TMoostMetadata
            return infactMeta
        },
        resolveParam({ paramMeta, classMeta, customData }) {
            if (paramMeta && customData && customData.pipes) {
                return runPipes(customData.pipes, undefined, { paramMeta, classMeta: classMeta as unknown as TMoostMetadata }, 'PARAM')
            }
        },
        describeProp(classConstructor, key) {
            const meta = getMoostMate().read(classConstructor, key)
            return meta as TMoostMetadata
        },
        resolveProp({ instance, key, initialValue, propMeta, classMeta, customData }) {
            if (propMeta && customData && customData.pipes) {
                return runPipes(customData.pipes, initialValue, { instance, key, propMeta, classMeta: classMeta as unknown as TMoostMetadata}, 'PROP')
            }
        },
        storeProvideRegByInstance: true,
    })
}
