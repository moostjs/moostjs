import { Infact, TInfactClassMeta } from '@prostojs/infact'
import { runPipes } from '../pipes/run-pipes'
import { sharedPipes } from '../pipes/shared-pipes'
import { getMoostMate, TMoostMetadata, TMoostParamsMetadata } from './moost-metadata'
import { useEventId } from '@wooksjs/event-core'

const sharedMoostInfact = getNewMoostInfact()

export function getMoostInfact(): Infact<TMoostMetadata, TMoostMetadata, TMoostParamsMetadata> {
    return sharedMoostInfact
}

export function getNewMoostInfact(): Infact<TMoostMetadata, TMoostMetadata, TMoostParamsMetadata> {
    return new Infact<TMoostMetadata, TMoostMetadata, TMoostParamsMetadata>({
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
        resolveParam(paramMeta, classMeta) {
            if (paramMeta.resolver) {
                return runPipes(sharedPipes, undefined, { paramMeta, classMeta: classMeta as unknown as TMoostMetadata }, 'PARAM')
            }
        },
        describeProp(classConstructor, key) {
            const meta = getMoostMate().read(classConstructor, key)
            return meta as TMoostMetadata
        },
        resolveProp(instance, key, initialValue, propMeta, classMeta) {
            if (propMeta.resolver) {
                return runPipes(sharedPipes, initialValue, { instance, key, propMeta, classMeta: classMeta as unknown as TMoostMetadata}, 'PROP')
            }
        },
        storeProvideRegByInstance: true,
    })
}
