import type { TEmpty, TObject } from '../common-types'
import type { TMoostHandler, TMoostMetadata, TMoostParamsMetadata } from '../metadata'
import { getMoostMate } from '../metadata'
import { resolveArguments } from '../resolve-arguments'
import { mergeSorted } from '../shared-utils'
import type { TControllerOverview, THandlerOverview } from '../types'
import { getIterceptorHandlerFactory } from '../utils'
import type { TBindControllerOptions } from './bind-types'
import { getInstanceOwnMethods } from './utils'

export async function bindControllerMethods(options: TBindControllerOptions) {
  const opts = options || {}
  const { getInstance } = opts
  const { classConstructor } = opts
  const { adapters } = opts
  opts.globalPrefix = opts.globalPrefix || ''
  opts.provide = opts.provide || {}
  const fakeInstance = Object.create(classConstructor.prototype) as TObject
  const methods = getInstanceOwnMethods(fakeInstance)
  const mate = getMoostMate()
  const meta = mate.read(classConstructor) || ({} as TMoostMetadata)
  const ownPrefix =
    typeof opts.replaceOwnPrefix === 'string'
      ? opts.replaceOwnPrefix
      : meta.controller?.prefix || ''
  const prefix = `${opts.globalPrefix}/${ownPrefix}`

  const controllerOverview: TControllerOverview = {
    meta,
    computedPrefix: prefix,
    type: classConstructor,
    handlers: [],
  }

  for (const method of methods) {
    const methodMeta = getMoostMate().read(fakeInstance, method as string) || ({} as TMoostMetadata)

    if (!methodMeta.handlers?.length) {
      continue
    }

    const pipes = mergeSorted(opts.pipes, methodMeta.pipes)
    const interceptors = mergeSorted(opts.interceptors, meta.interceptors, methodMeta.interceptors)

    const getIterceptorHandler = getIterceptorHandlerFactory(interceptors, getInstance, pipes)

    // preparing pipes
    const argsPipes: {
      meta: TMoostParamsMetadata
      pipes: typeof pipes
    }[] = []
    for (const p of methodMeta.params || ([] as TMoostParamsMetadata[])) {
      argsPipes.push({
        meta: p,
        pipes: mergeSorted(pipes, p.pipes),
      })
    }

    const resolveArgs = resolveArguments(argsPipes, {
      classMeta: meta,
      methodMeta,
      type: classConstructor,
      key: method,
    })

    const wm = new WeakMap<Required<typeof methodMeta>['handlers'][0], THandlerOverview>()

    controllerOverview.handlers.push(
      ...methodMeta.handlers.map((h) => {
        const data: THandlerOverview = {
          meta: methodMeta,
          path: h.path,
          type: h.type,
          method,
          handler: h,
          registeredAs: [],
        }
        wm.set(h, data)
        return data
      }),
    )

    for (const adapter of adapters) {
      await adapter.bindHandler({
        prefix,
        fakeInstance,
        getInstance,
        method,
        handlers: methodMeta.handlers,
        getIterceptorHandler,
        resolveArgs,
        controllerName: classConstructor.name,
        logHandler: (eventName: string) => {
          options.moostInstance.logMappedHandler(eventName, classConstructor, method as string)
        },
        register(h: TMoostHandler<TEmpty>, path: string, args: string[]) {
          const data = wm.get(h)
          if (data) {
            data.registeredAs.push({
              path,
              args,
            })
          }
        },
      })
    }
  }
  return controllerOverview
}
