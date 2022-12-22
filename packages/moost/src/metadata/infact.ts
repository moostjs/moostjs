import { Infact, TInfactClassMeta, TInfactConstructorParamMeta } from '@prostojs/infact'
import { runPipes } from '../pipes/run-pipes'
import { sharedPipes } from '../pipes/shared-pipes'
import { getMoostMate, TMoostParamsMetadata } from './moost-metadata'
import { useEventId } from '@wooksjs/event-core'

type TInfactMoostMeta = TInfactClassMeta<TMoostParamsMetadata & TInfactConstructorParamMeta> 

const sharedMoostInfact = getNewMoostInfact()

export function getMoostInfact(): Infact<TInfactMoostMeta> {
    return sharedMoostInfact
}

export function getNewMoostInfact(): Infact<TInfactMoostMeta> {
    return new Infact<TInfactMoostMeta>({
        describeClass(classConstructor) {
            const meta = getMoostMate().read(classConstructor)
            const infactMeta = {
                injectable: !!meta?.injectable,
                global: false,
                constructorParams: meta?.params || [],
                provide: meta?.provide,
                scopeId: meta?.injectable === 'FOR_EVENT' ? useEventId().getId() : undefined,
            }
            return infactMeta
        },
        resolveParam(paramMeta) {
            if (paramMeta.resolver) {
                return runPipes(sharedPipes, paramMeta)
            }
        },
        storeProvideRegByInstance: true,
    })
}
