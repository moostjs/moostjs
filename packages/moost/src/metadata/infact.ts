/* eslint-disable sonarjs/no-nested-switch */
import type { TInfactClassMeta } from '@prostojs/infact'
import { Infact } from '@prostojs/infact'
import { getConstructor } from '@prostojs/mate'
import { useEventId, useEventLogger } from '@wooksjs/event-core'
import { getDefaultLogger } from 'common'

import type { TPipeData } from '../pipes'
import { runPipes } from '../pipes/run-pipes'
import type { TMoostMetadata, TMoostParamsMetadata } from './moost-metadata'
import { getMoostMate } from './moost-metadata'

const sharedMoostInfact = getNewMoostInfact()
interface TInfactLoggingOptions {
  newInstance?: true | false | 'FOR_EVENT' | 'SINGLETON'
  warn?: true | false
  error?: true | false
}

let loggingOptions: TInfactLoggingOptions = {
  newInstance: 'SINGLETON',
  warn: true,
  error: true,
}

export function setInfactLoggingOptions(options: TInfactLoggingOptions) {
  loggingOptions = {
    ...loggingOptions,
    ...options,
  }
}

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

    on: (event, targetClass, message, args?) => {
      switch (event) {
        case 'new-instance': {
          const scope = getMoostMate().read(targetClass)?.injectable || 'SINGLETON'
          if (
            loggingOptions.newInstance === false ||
            loggingOptions.newInstance === scope ||
            (loggingOptions.newInstance === 'SINGLETON' && scope === true)
          ) {
            return
          }
          break
        }
        case 'warn': {
          if (!loggingOptions.warn) {
            return
          }
          break
        }
        case 'error': {
          if (!loggingOptions.error) {
            return
          }
          break
        }
      }
      let logger
      try {
        logger = event === 'error' ? getDefaultLogger('infact') : useEventLogger('infact')
      } catch (error) {
        logger = getDefaultLogger('infact')
      }
      const instance = `${__DYE_UNDERSCORE__}${targetClass.name}${__DYE_UNDERSCORE_OFF__}`
      switch (event) {
        case 'new-instance': {
          const params =
            args
              ?.map(a => {
                switch (typeof a) {
                  case 'number':
                  case 'boolean': {
                    return `${__DYE_YELLOW__}${a}${__DYE_DIM__ + __DYE_BLUE__}`
                  }
                  case 'string': {
                    return `${__DYE_GREEN_BRIGHT__}"${a.slice(0, 1)}..."${
                      __DYE_DIM__ + __DYE_BLUE__
                    }`
                  }
                  case 'object': {
                    if (Array.isArray(a)) {
                      return `[${a.length}]`
                    }
                    if (getConstructor(a)) {
                      return getConstructor(a).name
                    }
                    return '{}'
                  }
                  default: {
                    return '*'
                  }
                }
              })
              .map(a => `${__DYE_DIM__ + __DYE_BOLD__}${a}${__DYE_BOLD_OFF__ + __DYE_DIM__}`)
              .join(', ') || ''
          logger.info(`new ${instance}${__DYE_DIM__ + __DYE_BLUE__}(${params})`)
          break
        }
        case 'warn': {
          const hier = `${__DYE_DIM__ + __DYE_BLUE__}⋱ ${args?.map(String).join(' → ') || ''}`
          logger.warn(`${instance} - ${message} ${hier}`)
          break
        }
        case 'error': {
          const hier = `${__DYE_DIM__ + __DYE_BLUE__}⋱ ${args?.map(String).join(' → ') || ''}`
          logger.error(`Failed to instantiate ${instance}. ${message} ${hier}`)
          break
        }
        default: {
          break
        }
      }
    },
  })
}
