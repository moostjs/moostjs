import { clearGlobalWooks, disposeInstances, getMoostInfact, getMoostMate, Moost } from 'moost'

import type { createAdapterDetector } from './adapter-detector'
import type { TMoostViteDevOptions } from './moost-vite'
import { getLogger } from './utils'

/**
 * Clean up Moost’s global containers and optionally remove specific instances from the registry.
 *
 * Every instance actually removed from a registry is **disposed** before the
 * caches are dropped: its `@MoostDispose` hooks (or `Symbol.asyncDispose` /
 * `Symbol.dispose`) are awaited, so a singleton owning a connection, consumer,
 * timer or file handle releases it instead of leaking one copy per reload. An
 * instance kept by an `onEject` veto is never disposed. A failing hook is
 * warned about and the reload continues.
 *
 * @param {Set<string>} [cleanupInstances] A set of module IDs to remove from the registry.
 * @returns the instances that were ejected (and therefore disposed)
 */
export async function moostRestartCleanup(
  adapters: ReturnType<typeof createAdapterDetector>[],
  onEject?: TMoostViteDevOptions['onEject'],
  cleanupInstances?: Set<string>,
): Promise<object[]> {
  const logger = getLogger()
  const infact = getMoostInfact() as unknown as {
    registry: Record<symbol, object>
    scopes: Record<string | symbol, Record<symbol, object>>
  } & ReturnType<typeof getMoostInfact>

  const { registry, scopes } = infact

  const registries = [registry, ...Object.values(scopes)]

  // Clear any internal references
  infact._cleanup()

  const mate = getMoostMate<{ __vite_id?: string }>()

  /** Instances removed from a registry by this run — disposed below, before the caches drop. */
  const ejected: object[] = []

  // If we have specific IDs to remove, do so
  if (cleanupInstances) {
    for (const reg of registries) {
      for (const key of Object.getOwnPropertySymbols(reg)) {
        const instance = reg[key]
        const viteId = mate.read(instance)?.__vite_id
        if (viteId && cleanupInstances.has(viteId)) {
          logger.debug(`🔃 Replacing "${constructorName(instance)}"`)
          delete reg[key]
          ejected.push(instance)
        }
      }

      for (const key of Object.getOwnPropertySymbols(reg)) {
        const instance = reg[key]
        scanParams(instance, (type: Function) => {
          if (
            (type === Moost || type instanceof Moost || type.prototype instanceof Moost) &&
            (!onEject || onEject(instance, type))
          ) {
            delete reg[key]
            ejected.push(instance)
            logger.debug(
              `✖️  Ejecting "${constructorName(instance)}" (depends on re-instantiated "Moost")`,
            )
            return true
          }
          for (const adapter of adapters) {
            if (adapter.compare(type) && (!onEject || onEject(instance, type))) {
              delete reg[key]
              ejected.push(instance)
              logger.debug(
                `✖️  Ejecting "${constructorName(instance)}" (depends on re-instantiated "${
                  adapter.constructor!.name
                }")`,
              )
              return true
            }
          }
        })
      }
      // need to remove instances with unknown dependencies
      clearDependantRegistry(reg, onEject, ejected)
    }
    infact.registry = registry
    infact.scopes = scopes
  }

  // Run the ejected instances' dispose hooks BEFORE the Mate cache is dropped
  // below (the hooks are discovered through metadata) and before the entry
  // re-imports, so the replacement instance never races the old one for the
  // same connection/consumer/handle. Best effort: a throwing hook must not
  // break the dev loop.
  await disposeEjected(ejected)

  // Drop Mate's read cache and reset global wooks. NOTE: `Mate._cleanup()` does
  // NOT wipe decorator metadata in Node — mate's reflect shim only carries a
  // `_cleanup` implementation when it owns `globalThis.Reflect` (never true in
  // Node), so the call below only resets the memoized read cache. That is the
  // intended contract here: metadata storage is keyed by class object identity
  // (WeakMap), re-imported modules produce NEW class objects that decorate
  // themselves fresh, and OLD class objects must keep their metadata because
  // ejected-but-still-referenced instances continue to read it until the old
  // pipeline is fully released. Do not build on the assumption of a wipe.
  getMoostMate()._cleanup()
  clearGlobalWooks()
  return ejected
}

/** Awaits the `@MoostDispose` hooks of the ejected instances; never throws. */
async function disposeEjected(ejected: object[]) {
  if (ejected.length === 0) {
    return
  }
  const logger = getLogger()
  const { disposed, errors } = await disposeInstances(ejected, { logger, onError: 'warn' })
  for (const instance of disposed) {
    logger.debug(`♻️  Disposed "${constructorName(instance)}"`)
  }
  for (const e of errors) {
    logger.warn(
      `⚠️  Dispose hook "${constructorName(e.instance)}.${String(
        e.method,
      )}" failed — the reload continues`,
    )
  }
}

function clearDependantRegistry(
  registry: Record<symbol, object>,
  onEject: TMoostViteDevOptions['onEject'] | undefined,
  ejected: object[],
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
      if (checkAndEject(instance, objSet, onEject, registry, key, logger)) {
        ejected.push(instance)
        somethingIsDeleted = true
      }
    }
  }
}

function checkAndEject(
  instance: object,
  objSet: Set<unknown>,
  onEject: TMoostViteDevOptions['onEject'] | undefined,
  registry: Record<symbol, object>,
  key: symbol,
  logger: ReturnType<typeof getLogger>,
): boolean {
  let ejected = false
  scanParams(instance, (type: Function) => {
    if (!objSet.has(type) && (!onEject || onEject(instance, type))) {
      delete registry[key]
      logger.debug(
        `✖️  Ejecting "${constructorName(instance)}" (depends on "${
          type.name
        }" which is not in registry)`,
      )
      ejected = true
      return true
    }
  })
  return ejected
}

function scanParams(instance: object, cb: (type: Function) => boolean | undefined) {
  const mate = getMoostMate()
  const params = mate.read(instance)?.params
  if (params?.length) {
    for (const param of params) {
      if (
        param.type === undefined ||
        [Array, String, Number, Boolean, Object].includes(
          param.type as unknown as StringConstructor,
        )
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
  return Object.getPrototypeOf(i).constructor.name
}
