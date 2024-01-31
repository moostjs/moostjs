import type { TInfactClassMeta } from '@prostojs/infact'
import { Infact } from '@prostojs/infact'
import { useEventId } from '@wooksjs/event-core'

import type { TPipeData } from '../pipes'
import { runPipes } from '../pipes/run-pipes'
import type { TMoostMetadata, TMoostParamsMetadata } from './moost-metadata'
import { getMoostMate } from './moost-metadata'

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
      return {
        injectable: !!meta?.injectable,
        global: false,
        constructorParams: meta?.params || [],
        provide: meta?.provide,
        properties: meta?.properties || [],
        scopeId: meta?.injectable === 'FOR_EVENT' ? useEventId().getId() : undefined,
      } as unknown as TInfactClassMeta<TMoostParamsMetadata> & TMoostMetadata
    },
    resolveParam({ paramMeta, classMeta, customData, classConstructor, index }) {
      if (paramMeta && customData?.pipes) {
        return runPipes(
          customData.pipes,
          undefined,
          {
            paramMeta,
            type: classConstructor,
            key: 'constructor',
            classMeta: classMeta as unknown as TMoostMetadata,
            index,
            targetMeta: paramMeta,
          },
          'PARAM'
        )
      }
    },
    describeProp(classConstructor, key) {
      const meta = getMoostMate().read(classConstructor, key)
      return meta as TMoostMetadata
    },
    resolveProp({
      instance,
      key,
      initialValue,
      propMeta,
      classMeta,
      customData,
      classConstructor,
    }) {
      if (propMeta && customData?.pipes) {
        return runPipes(
          customData.pipes,
          initialValue,
          {
            instance,
            type: classConstructor,
            key,
            propMeta,
            targetMeta: propMeta,
            classMeta: classMeta as unknown as TMoostMetadata,
          },
          'PROP'
        )
      }
    },
    storeProvideRegByInstance: true,
  })
}
