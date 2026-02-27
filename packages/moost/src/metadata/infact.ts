import type { TInfactClassMeta } from '@prostojs/infact'
import { Infact } from '@prostojs/infact'
import { getConstructor } from '@prostojs/mate'
import { useLogger } from '@wooksjs/event-core'

import { useScopeId } from '../adapter-utils'
import { getDefaultLogger } from '../logger'
import type { TPipeData } from '../pipes'
import { runPipes } from '../pipes/run-pipes'
import type { TMoostMetadata, TMoostParamsMetadata } from './moost-metadata'
import { getMoostMate } from './moost-metadata'

const sharedMoostInfact = getNewMoostInfact()
const INFACT_BANNER = `${__DYE_DIM__ + __DYE_MAGENTA__}infact`
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

/** Configures which Infact DI events are logged (instance creation, warnings, errors). */
export function setInfactLoggingOptions(options: TInfactLoggingOptions) {
  loggingOptions = {
    ...loggingOptions,
    ...options,
  }
}

/** Returns the shared Infact DI container used by Moost for dependency injection. */
export function getMoostInfact() {
  return sharedMoostInfact
}

interface TCustom {
  pipes?: TPipeData[]
}

const scopeVarsMap = new Map<string | symbol, unknown>()

/**
 * Define global scope name to be used with `@InjectFromScope` and `@InjectScopeVars` decorators
 *
 * You can read scoped vars with `getInfactScopeVars`
 * @param name scope name
 * @param scopeVars key-value object as scoped vars
 */
export function defineInfactScope<T extends object>(name: string | symbol, scopeVars: T) {
  scopeVarsMap.set(name, scopeVars)
  getMoostInfact().registerScope(name)
}

/**
 * Read scoped vars defined with `defineInfactScope`
 * @param name scope name
 * @returns key-value object as scoped vars
 */
export function getInfactScopeVars<T extends object>(name: string | symbol) {
  return scopeVarsMap.get(name) as T | undefined
}

/**
 * Get Infact instance (used for Dependency Injections)
 */
export function getNewMoostInfact() {
  const infactInstance = new Infact<TMoostMetadata, TMoostMetadata, TMoostParamsMetadata, TCustom>({
    describeClass(classConstructor) {
      const meta = getMoostMate().read(classConstructor)
      return {
        injectable: !!meta?.injectable,
        global: false,
        constructorParams: meta?.params || [],
        provide: meta?.provide,
        properties: meta?.properties || [],
        scopeId: meta?.injectable === 'FOR_EVENT' ? useScopeId() : undefined,
      } as unknown as TInfactClassMeta<TMoostParamsMetadata> & TMoostMetadata
    },

    resolveParam({ paramMeta, customData, classConstructor, index, scopeId, instantiate }) {
      if (paramMeta && customData?.pipes) {
        return runPipes(
          customData.pipes,
          undefined,
          {
            paramMeta,
            type: classConstructor,
            key: 'constructor',
            scopeId,
            classMeta: getMoostMate().read(classConstructor),
            index,
            targetMeta: paramMeta,
            instantiate,
          },
          'PARAM',
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
      scopeId,
      classMeta,
      customData,
      classConstructor,
      instantiate,
    }) {
      if (propMeta && customData?.pipes) {
        return runPipes(
          customData.pipes,
          initialValue,
          {
            instance,
            type: classConstructor,
            key,
            scopeId,
            propMeta,
            targetMeta: propMeta,
            classMeta: classMeta as unknown as TMoostMetadata,
            instantiate,
          },
          'PROP',
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
            !(
              loggingOptions.newInstance === scope ||
              (loggingOptions.newInstance === 'SINGLETON' && scope === true)
            )
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
        default:
      }
      let logger
      try {
        const ctxLogger = event === 'error' ? getDefaultLogger(INFACT_BANNER) : useLogger()
        const withTopic = ctxLogger as { topic?: (name?: string) => typeof ctxLogger }
        logger =
          typeof withTopic.topic === 'function' ? withTopic.topic(INFACT_BANNER) : ctxLogger
      } catch (error) {
        logger = getDefaultLogger(INFACT_BANNER)
      }
      const instance = `${__DYE_UNDERSCORE__}${targetClass.name}${__DYE_UNDERSCORE_OFF__}`
      switch (event) {
        case 'new-instance': {
          const params =
            args
              ?.map((a) => {
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
              .map((a) => `${__DYE_DIM__ + __DYE_BOLD__}${a}${__DYE_BOLD_OFF__ + __DYE_DIM__}`)
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
  return infactInstance
}
