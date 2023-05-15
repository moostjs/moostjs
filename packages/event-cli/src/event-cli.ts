import {
    TMoostAdapter,
    TMoostAdapterOptions,
    setControllerContext,
} from 'moost'
import {
    WooksCli,
    TWooksCliOptions,
    createCliApp,
    useCliContext,
} from '@wooksjs/event-cli'
import { useEventId, useEventLogger } from '@wooksjs/event-core'
import { getCliMate } from './meta-types'

export interface TCliHandlerMeta {
    path: string
}

export class MoostCli implements TMoostAdapter<TCliHandlerMeta> {
    protected cliApp: WooksCli

    constructor(cliApp?: WooksCli | TWooksCliOptions) {
        if (cliApp && cliApp instanceof WooksCli) {
            this.cliApp = cliApp
        } else if (cliApp) {
            this.cliApp = createCliApp(cliApp)
        } else {
            this.cliApp = createCliApp()
        }
    }

    onInit() {
        void this.cliApp.run()
    }

    bindHandler<T extends object = object>(
        opts: TMoostAdapterOptions<TCliHandlerMeta, T>
    ): void | Promise<void> {
        let fn
        for (const handler of opts.handlers) {
            if (handler.type !== 'CLI') continue
            const path =
                typeof handler.path === 'string'
                    ? handler.path
                    : typeof opts.method === 'string'
                        ? opts.method
                        : ''
            const targetPath = `${opts.prefix || ''}/${path}`.replace(
                /\/\/+/g,
                '/'
            )

            if (!fn) {
                fn = async () => {
                    const { restoreCtx } = useCliContext()
                    const scopeId = useEventId().getId()
                    const logger = useEventLogger('moost-cli')
                    const unscope = opts.registerEventScope(scopeId)

                    const instance = await opts.getInstance()
                    restoreCtx()

                    setControllerContext(instance, opts.method)

                    console.log(JSON.stringify(helpObject, null, '  '))

                    let response: unknown
                    const interceptorHandler = await opts.getIterceptorHandler()
                    restoreCtx()
                    try {
                        // logger.trace('initializing interceptors')
                        await interceptorHandler.init()
                    } catch (e) {
                        logger.error(e)
                        response = e
                    }

                    let args: unknown[] = []
                    if (!response) {
                        // params
                        restoreCtx()
                        try {
                            // logger.trace(`resolving method args for "${ opts.method as string }"`)
                            args = await opts.resolveArgs()
                            // logger.trace(`args for method "${ opts.method as string }" resolved (count ${String(args.length)})`)
                        } catch (e) {
                            logger.error(e)
                            response = e
                        }
                    }

                    if (!response) {
                        restoreCtx()
                        // fire before interceptors
                        // logger.trace('firing before interceptors')
                        response = await interceptorHandler.fireBefore(response)
                        // fire request handler
                        if (!interceptorHandler.responseOverwritten) {
                            try {
                                restoreCtx()
                                // logger.trace(`firing method "${ opts.method as string }"`)
                                response = await (
                                    instance[opts.method] as unknown as (
                                        ...a: typeof args
                                    ) => unknown
                                )(...args)
                            } catch (e) {
                                logger.error(e)
                                response = e
                            }
                        }
                    }

                    // fire after interceptors
                    restoreCtx()
                    try {
                        // logger.trace('firing after interceptors')
                        response = await interceptorHandler.fireAfter(response)
                    } catch (e) {
                        logger.error(e)
                        unscope()
                        throw e
                    }

                    unscope()
                    return response
                }
            }
            const { getArgs, getStaticPart } = this.cliApp.cli(targetPath, fn)
            console.log((opts.method as string) + ' args:', getArgs())

            // todo: gather cli commands for help renderer
            const meta = getCliMate().read(opts.fakeInstance, opts.method as string)
            helpObject[targetPath] = {
                description: meta?.description || '',
                command: getStaticPart().replace(/\//g, ' ').trim(),
                params: meta?.params?.filter(param => !!param.cliParamKeys && param.cliParamKeys.length > 0).map(param => ({
                    keys: param.cliParamKeys,
                    description: param.description || '',
                })) || [],
                args: getArgs(),
            }
            // opts.logHandler(`${__DYE_CYAN__}(CLI)${ __DYE_GREEN__ }${ targetPath }`)
        }
    }
}

const helpObject: Record<string, {
    description: string
    command: string
    params: { keys: string[], description: string }[]
    args: string[]
}> = {}
