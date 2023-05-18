import { getMoostMate, TMoostMetadata, TMoostParamsMetadata } from '../metadata'
import { TPipeData } from '../pipes'
import { TObject } from 'common'
import { getInstanceOwnMethods } from './utils'
import { runPipes } from '../pipes/run-pipes'
import { useEventContext } from '@wooksjs/event-core'
import { getIterceptorHandlerFactory } from '../utils'
import { TBindControllerOptions } from './bind-types'

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
    for (const method of methods) {
        const methodMeta = getMoostMate().read(fakeInstance, method) || {}
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
        for (const p of methodMeta.params || []) {
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
                    },
                    'PARAM',
                    restoreCtx
                )
            }
            return args
        }

        // preparing provide
        // const provide = {...(opts.provide || {}), ...(meta.provide || {})}

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
            })
        }
    }
}
