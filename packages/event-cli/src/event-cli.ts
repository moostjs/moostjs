import { TMoostAdapter, TMoostAdapterOptions } from 'moost'
import { WooksCli, TWooksCliOptions, createCliApp, useCliContext } from '@wooksjs/event-cli'
import { useEventId } from '@wooksjs/event-core'

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

    bindHandler<T extends object = object>(opts: TMoostAdapterOptions<TCliHandlerMeta, T>): void | Promise<void> {
        let fn
        for (const handler of opts.handlers) {
            if (handler.type !== 'CLI') continue
            const path = typeof handler.path === 'string' ? handler.path : typeof opts.method === 'string' ? opts.method : ''
            const targetPath = `${opts.prefix || ''}/${path}`.replace(/\/\/+/g, '/')
            if (!fn) {
                fn = async () => {
                    const { restoreCtx } = useCliContext()
                    const scopeId = useEventId().getId()
                    const unscope = opts.registerEventScope(scopeId)

                    const instance = await opts.getInstance()
                    restoreCtx()

                    let response: unknown
                    const interceptorHandler = await opts.getIterceptorHandler()
                    restoreCtx()
                    await interceptorHandler.init()

                    // params
                    let args: unknown[] = []
                    try {
                        restoreCtx()
                        args = await opts.resolveArgs()
                    } catch (e) {
                        response = e
                    }

                    if (!response) {
                        restoreCtx()
                        // fire before interceptors
                        response = await interceptorHandler.fireBefore(response)
                        // fire request handler
                        if (!interceptorHandler.responseOverwritten) {
                            try {
                                restoreCtx()
                                response = await (instance[opts.method] as unknown as (...a: typeof args) => unknown)(...args)
                            } catch (e) {
                                response = e
                            }
                        }
                    }

                    restoreCtx()
                    // fire after interceptors
                    response = await interceptorHandler.fireAfter(response)
                    unscope()
                    return response
                }
            }
            this.cliApp.cli(targetPath, fn)
            opts.logHandler(`${__DYE_CYAN__}(CLI)${ __DYE_GREEN__ }${ targetPath }`)
        }
    }
}
