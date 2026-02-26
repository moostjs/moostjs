import type { TEmpty, TObject, TClassConstructor } from '../common-types'
import { useControllerContext } from '../composables'
import type { TMoostHandler, TMoostMetadata, TMoostParamsMetadata } from '../metadata'
import { getMoostMate } from '../metadata'
import type { TPipeData } from '../pipes'
import { runPipes } from '../pipes/run-pipes'
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

    const pipes = [...(opts.pipes || []), ...(methodMeta.pipes || [])].toSorted(
      (a, b) => a.priority - b.priority,
    )
    const interceptors = [
      ...(opts.interceptors || []),
      ...(meta.interceptors || []),
      ...(methodMeta.interceptors || []),
    ].toSorted((a, b) => a.priority - b.priority)

    const getIterceptorHandler = getIterceptorHandlerFactory(interceptors, getInstance, pipes)

    // preparing pipes
    const argsPipes: {
      meta: TMoostParamsMetadata
      pipes: TPipeData[]
    }[] = []
    for (const p of methodMeta.params || ([] as TMoostParamsMetadata[])) {
      argsPipes.push({
        meta: p,
        pipes: [...pipes, ...(p.pipes || [])].toSorted((a, b) => a.priority - b.priority),
      })
    }

    const resolveArgs = argsPipes.length === 0
      ? undefined
      : () => {
          const args: unknown[] = []
          let hasAsync = false
          for (let i = 0; i < argsPipes.length; i++) {
            const { pipes, meta: paramMeta } = argsPipes[i]
            const result = runPipes(
              pipes,
              undefined,
              {
                classMeta: meta,
                methodMeta,
                paramMeta,
                type: classConstructor,
                key: method,
                index: i,
                targetMeta: paramMeta,
                instantiate: <T extends TObject>(t: TClassConstructor<T>) =>
                  useControllerContext().instantiate(t),
              },
              'PARAM',
            )
            if (!hasAsync && result && typeof (result as PromiseLike<unknown>).then === 'function') {
              hasAsync = true
            }
            args[i] = result
          }
          if (hasAsync) {
            return Promise.all(args)
          }
          return args
        }

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
