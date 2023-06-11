import { getMoostMate, TMoostHandler, TMoostMetadata, TMoostParamsMetadata } from '../metadata'
import { TPipeData } from '../pipes'
import { TEmpty, TObject } from 'common'
import { getInstanceOwnMethods } from './utils'
import { runPipes } from '../pipes/run-pipes'
import { useEventContext } from '@wooksjs/event-core'
import { getIterceptorHandlerFactory } from '../utils'
import { TBindControllerOptions } from './bind-types'
import { TControllerOverview } from '../types'
import { THandlerOverview } from '../types'

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
        handlers: [],
    }

    for (const method of methods) {
        const methodMeta = getMoostMate().read(fakeInstance, method as string) || {} as TMoostMetadata
        methodMeta.handlers
        if (!methodMeta.handlers || !methodMeta.handlers.length) continue

        const pipes = [...(opts.pipes || []), ...(methodMeta.pipes || [])].sort(
            (a, b) => a.priority - b.priority
        )
        // preparing interceptors
        const interceptors = [
            ...(opts.interceptors || []),
            ...(meta.interceptors || []),
            ...(methodMeta.interceptors || []),
        ].sort((a, b) => a.priority - b.priority)

        const getIterceptorHandler = getIterceptorHandlerFactory(interceptors, getInstance, pipes, options.logger)

        // preparing pipes
        const argsPipes: {
            meta: TMoostParamsMetadata
            pipes: TPipeData[]
        }[] = []
        for (const p of methodMeta.params || [] as TMoostParamsMetadata[]) {
            argsPipes.push({
                meta: p,
                pipes: [...pipes, ...(p.pipes || [])].sort(
                    (a, b) => a.priority - b.priority
                ),
            })
        }

        const resolveArgs = async () => {
            const args: unknown[] = []
            const { restoreCtx } = useEventContext()
            for (let i = 0; i < argsPipes.length; i++) {
                const { pipes, meta: paramMeta } = argsPipes[i]
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
                    },
                    'PARAM',
                    restoreCtx
                )
            }
            return args
        }

        const wm = new WeakMap<Required<(typeof methodMeta)>['handlers'][0], THandlerOverview>()

        controllerOverview.handlers.push(...methodMeta.handlers.map(h => {
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
        }))

        for (const adapter of adapters) {
            await adapter.bindHandler({
                prefix,
                fakeInstance,
                getInstance,
                method,
                handlers: methodMeta.handlers,
                getIterceptorHandler,
                resolveArgs,
                logHandler: (eventName: string) =>
                    options.logger.info(
                        `• ${eventName} ${
                            __DYE_RESET__ + __DYE_DIM__ + __DYE_GREEN__
                        }→ ${classConstructor.name}.${__DYE_CYAN__}${
                            method as string
                        }${__DYE_GREEN__}()`
                    ),
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
