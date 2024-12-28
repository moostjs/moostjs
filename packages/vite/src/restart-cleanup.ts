/* eslint-disable @typescript-eslint/no-loop-func */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/ban-types */
/* eslint-disable @typescript-eslint/naming-convention */
import { getGlobalWooks, getMoostInfact, getMoostMate, Moost } from 'moost'

import type { createAdapterDetector } from './adapter-detector'
import type { TMoostViteDevOptions } from './moost-vite-dev'
import { getLogger } from './utils'

/**
 * Clean up Moost’s global containers and optionally remove specific instances from the registry.
 *
 * @param {Set<string>} [cleanupInstances] A set of module IDs to remove from the registry.
 */
export function moostRestartCleanup(
  adapters: Array<ReturnType<typeof createAdapterDetector>>,
  onEject?: TMoostViteDevOptions['onEject'],
  cleanupInstances?: Set<string>
) {
  const logger = getLogger()
  const infact = getMoostInfact() as unknown as {
    registry: Record<symbol, object>
  } & ReturnType<typeof getMoostInfact>

  const { registry } = infact

  // Clear any internal references
  infact._cleanup()

  const mate = getMoostMate<{ __vite_id?: string }>()

  // If we have specific IDs to remove, do so
  if (cleanupInstances) {
    for (const key of Object.getOwnPropertySymbols(registry)) {
      const instance = registry[key]
      const viteId = mate.read(instance)?.__vite_id
      if (viteId && cleanupInstances.has(viteId)) {
        logger.debug(`🔃 Replacing "${constructorName(instance)}"`)
        delete registry[key]
      }
    }

    for (const key of Object.getOwnPropertySymbols(registry)) {
      const instance = registry[key]
      scanParams(instance, (type: Function) => {
        if (
          (type === Moost || type instanceof Moost || type.prototype instanceof Moost) &&
          (!onEject || onEject(instance, type))
        ) {
          delete registry[key]
          logger.debug(
            `✖️  Ejecting "${constructorName(instance)}" (depends on re-instantiated "Moost")`
          )
          return true
        }
        for (const adapter of adapters) {
          if (adapter.compare(type) && (!onEject || onEject(instance, type))) {
            delete registry[key]
            logger.debug(
              `✖️  Ejecting "${constructorName(instance)}" (depends on re-instantiated "${
                adapter.constructor!.name
              }")`
            )
            return true
          }
        }
      })
    }
    // need to remove instances with unknown dependencies
    clearDependantRegistry(registry, onEject)
    infact.registry = registry
  }

  // Clean up metadata and wooks
  getMoostMate()._cleanup()
  getGlobalWooks(undefined, undefined, 'cleanup')
}

function clearDependantRegistry(
  registry: Record<symbol, object>,
  onEject?: TMoostViteDevOptions['onEject']
) {
  const logger = getLogger()
  const objSet = new Set()
  let somethingIsDeleted = true
  while (somethingIsDeleted) {
    somethingIsDeleted = false
    for (const key of Object.getOwnPropertySymbols(registry)) {
      const instance = registry[key]
      objSet.add(Object.getPrototypeOf(instance).constructor)
    }
    for (const key of Object.getOwnPropertySymbols(registry)) {
      const instance = registry[key]
      scanParams(instance, (type: Function) => {
        if (!objSet.has(type) && (!onEject || onEject(instance, type))) {
          delete registry[key]
          logger.debug(
            `✖️  Ejecting "${constructorName(instance)}" (depends on "${
              type.name
            }" which is not in registry)`
          )
          somethingIsDeleted = true
          return true
        }
      })
    }
  }
}

// eslint-disable-next-line @typescript-eslint/no-invalid-void-type
function scanParams(instance: object, cb: (type: Function) => boolean | void) {
  const mate = getMoostMate()
  const params = mate.read(instance)?.params
  if (params?.length) {
    for (const param of params) {
      if (
        param.type === undefined ||
        [Array, String, Number, Boolean].includes(param.type as unknown as StringConstructor)
      ) {
        // skip undefined and primitive types
        continue
      }
      if (cb(param.type)) {
        break
      }
    }
  }
}

function constructorName(i: object) {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  return Object.getPrototypeOf(i).constructor.name
}
