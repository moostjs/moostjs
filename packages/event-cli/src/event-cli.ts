import {
    Moost,
    TMoostAdapter,
    TMoostAdapterOptions,
    defineMoostEventHandler,
} from 'moost'
import {
    WooksCli,
    TWooksCliOptions,
    createCliApp,
    useCliContext,
} from '@wooksjs/event-cli'
import { getCliMate } from './meta-types'
import { CliHelpRenderer, TCliHelpOptions } from '@prostojs/cli-help'

export interface TCliHandlerMeta {
    path: string
}

export interface TMoostCliOpts {
    wooksCli?: WooksCli | TWooksCliOptions
    cliHelp?: CliHelpRenderer | TCliHelpOptions
}

const LOGGER_TITLE = 'moost-cli'
const CONTEXT_TYPE = 'CLI'

export class MoostCli implements TMoostAdapter<TCliHandlerMeta> {
    protected cliApp: WooksCli

    protected cliHelp: CliHelpRenderer

    constructor(opts?: TMoostCliOpts) {
        const cliAppOpts = opts?.wooksCli
        if (cliAppOpts && cliAppOpts instanceof WooksCli) {
            this.cliApp = cliAppOpts
        } else if (cliAppOpts) {
            this.cliApp = createCliApp({
                ...cliAppOpts,
                onNotFound: this.onNotFound.bind(this),
            })
        } else {
            this.cliApp = createCliApp({
                onNotFound: this.onNotFound.bind(this),
            })
        }
        const cliHelpOpts = opts?.cliHelp
        if (cliHelpOpts && cliHelpOpts instanceof CliHelpRenderer) {
            this.cliHelp = cliHelpOpts
        } else if (cliHelpOpts) {
            this.cliHelp = new CliHelpRenderer(cliHelpOpts)
        } else {
            this.cliHelp = new CliHelpRenderer()
        }
    }

    async onNotFound() {
        const pathParams = useCliContext().store('event').get('pathParams')
        const response = await defineMoostEventHandler({
            loggerTitle: LOGGER_TITLE,
            getIterceptorHandler: () => this.moost?.getGlobalInterceptorHandler(),
            getControllerInstance: () => this.moost,
            callControllerMethod: () => undefined,
            hooks: {
                init: () => {
                    useCliContext<{ event: { cliHelp: CliHelpRenderer } }>().store('event').set('cliHelp', this.cliHelp)
                },
            },
        })()
        if (typeof response === 'undefined') {
            this.cliApp.onUnknownCommand(pathParams)
        }
    }

    protected moost?: Moost

    onInit(moost: Moost) {
        this.moost = moost
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
            const targetPath = `${opts.prefix || ''}/${path}`
                .replace(/\/\/+/g, '/')
                // avoid interpreting "cmd:tail" as "cmd/:tail"
                .replace(/\/\\:/g, '\\:')

            let cliCommand = ''

            if (!fn) {
                fn = defineMoostEventHandler({
                    contextType: CONTEXT_TYPE,
                    loggerTitle: LOGGER_TITLE,
                    getIterceptorHandler: opts.getIterceptorHandler,
                    getControllerInstance: opts.getInstance,
                    controllerMethod: opts.method,
                    resolveArgs: opts.resolveArgs,
                    hooks: {
                        init: () => {
                            useCliContext<{ event: { cliHelp: CliHelpRenderer } }>().store('event').set('cliHelp', this.cliHelp)
                        },
                    },
                })
            }
            const { getArgs, getStaticPart } = this.cliApp.cli(targetPath, fn)
            const meta = getCliMate().read(opts.fakeInstance, opts.method as string)
             
            const args: Record<string, string> = {}
            getArgs().forEach(a => {
                const argParam = meta?.params?.find(p => p.label === a && p.description)
                args[a] = argParam?.description || ''
            })
            cliCommand = getStaticPart().replace(/\//g, ' ').trim()
            this.cliHelp.addEntry({
                description: meta?.description || '',
                command: cliCommand,
                options: meta?.params?.filter(param => !!param.cliParamKeys && param.cliParamKeys.length > 0).map(param => ({
                    keys: param.cliParamKeys,
                    description: param.description || '',
                })) || [],
                args,
            })
            opts.logHandler(`${__DYE_CYAN__}(CLI)${ __DYE_GREEN__ }${ targetPath }`)
        }
    }
}
