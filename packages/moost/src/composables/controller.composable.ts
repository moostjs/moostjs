import type { EventContext } from '@wooksjs/event-core'
import { current } from '@wooksjs/event-core'

import { getConstructor } from '@prostojs/mate'

import { adapterProvideToken, getAdapterBrand } from '../adapter-brand'
import type { TAny, TClassConstructor } from '../common-types'
import { getDefaultLogger } from '../logger'
import { getMoostInfact, getMoostMate } from '../metadata'
import { globalKey } from './global-key'

const controllerInstanceKey = globalKey<unknown>('controller.instance')
const controllerMethodKey = globalKey<string>('controller.method')
const controllerRouteKey = globalKey<string>('controller.route')
const controllerPrefixKey = globalKey<string>('controller.prefix')

/**
 * Sets the controller context for the current event scope.
 * Called internally by adapters when dispatching events to handlers.
 */
export function setControllerContext<T>(
  controller: T,
  method: keyof T,
  route: string,
  opts?: { prefix?: string; ctx?: EventContext },
) {
  const _ctx = opts?.ctx || current()
  _ctx.set(controllerInstanceKey, controller)
  _ctx.set(controllerMethodKey, method as string)
  _ctx.set(controllerRouteKey, route)
  if (opts?.prefix !== undefined) {
    _ctx.set(controllerPrefixKey, opts.prefix)
  }
}

/** Brands already warned about by {@link brandedAdapterFor} (one warning per process). */
const reportedAdapterCopies = new Set<string>()

/**
 * The attached adapter `instantiate(c)` resolves through its brand (see `MOOST_ADAPTER_BRAND`)
 * when `c` is not that adapter's own class: a base class of a custom adapter, or the adapter class
 * from another copy of its package (warned once). `undefined` → the plain DI lookup applies.
 */
function brandedAdapterFor(controller: object, c: TClassConstructor<unknown>): object | undefined {
  const brand = getAdapterBrand(c)
  if (brand === undefined) {
    return undefined
  }
  const registries = getMoostInfact().getInstanceRegistries(controller)
  const adapter = registries.provide?.[adapterProvideToken(brand)]?.fn() as object | undefined
  const attached = adapter ? getConstructor(adapter) : undefined
  // A subclass of the attached adapter's class is a distinct injectable, not the adapter.
  if (!attached || attached === c || c.prototype instanceof attached) {
    return undefined
  }
  if (!(adapter instanceof c) && !reportedAdapterCopies.has(brand)) {
    reportedAdapterCopies.add(brand)
    getDefaultLogger('moost').warn(
      `instantiate(${c.name}) resolved the attached adapter through its brand "${brand}": the class passed in comes from another copy of its package. Two copies of a package split its module state — make the bundler / SSR externalization load one copy (for @moostjs/vite see the ssrExternalCheck warnings).`,
    )
  }
  return adapter
}

/**
 * Provides access to the current controller context within an event handler.
 * Returns utilities for accessing the controller instance, method metadata, and DI.
 */
export function useControllerContext<T extends object>(ctx?: EventContext) {
  const _ctx = ctx || current()

  const getController = () => _ctx.get(controllerInstanceKey) as T
  const getMethod = () => _ctx.get(controllerMethodKey) as string | undefined
  const getRoute = () => _ctx.get(controllerRouteKey)
  const getPrefix = () => _ctx.get(controllerPrefixKey)
  // todo: add generic types to getControllerMeta
  const getControllerMeta = <TT extends object>() =>
    getMoostMate<TT, TT, TT>().read(getController())
  // todo: add generic types to getMethodMeta
  const getMethodMeta = <TT extends object>(name?: string) =>
    getMoostMate<TT, TT, TT>().read(getController(), name || getMethod())

  function instantiate<TT>(c: TClassConstructor<TT>): Promise<TT> {
    const controller = getController()
    const adapter = brandedAdapterFor(controller, c)
    return adapter
      ? Promise.resolve(adapter as TT)
      : (getMoostInfact().getForInstance(controller, c as TClassConstructor<TAny>) as Promise<TT>)
  }

  return {
    instantiate,
    getRoute,
    getPrefix,
    getController,
    getMethod,
    getControllerMeta,
    getMethodMeta,
    getPropertiesList: () => getControllerMeta()?.properties || [],
    getScope: () => getControllerMeta()?.injectable || 'SINGLETON',
    getParamsMeta: () => getMethodMeta()?.params || [],
    getPropMeta: (name: string) => getMethodMeta(name),
  }
}
