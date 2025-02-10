/* eslint-disable unicorn/consistent-destructuring */
import type { TEmpty, TObject } from '../common-types'
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
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
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

    const pipes = [...(opts.pipes || []), ...(methodMeta.pipes || [])].sort(
      (a, b) => a.priority - b.priority
    )
    // preparing interceptors
    const interceptors = [
      ...(opts.interceptors || []),
      ...(meta.interceptors || []),
      ...(methodMeta.interceptors || []),
    ].sort((a, b) => a.priority - b.priority)

    const getIterceptorHandler = getIterceptorHandlerFactory(
      interceptors,
      getInstance,
      pipes,
      options.logger
    )

    // preparing pipes
    const argsPipes: Array<{
      meta: TMoostParamsMetadata
      pipes: TPipeData[]
    }> = []
    for (const p of methodMeta.params || ([] as TMoostParamsMetadata[])) {
      argsPipes.push({
        meta: p,
        pipes: [...pipes, ...(p.pipes || [])].sort((a, b) => a.priority - b.priority),
      })
    }

    const resolveArgs = async () => {
      const args: unknown[] = []
      for (const [i, { pipes, meta: paramMeta }] of argsPipes.entries()) {
        args[i] = await runPipes(
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
          },
          'PARAM'
        )
      }
      return args
    }

    const wm = new WeakMap<Required<typeof methodMeta>['handlers'][0], THandlerOverview>()

    controllerOverview.handlers.push(
      ...methodMeta.handlers.map(h => {
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
      })
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
        // eslint-disable-next-line @typescript-eslint/no-loop-func
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
