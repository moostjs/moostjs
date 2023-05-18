import {
    Moost,
    TMoostAdapter,
    TMoostAdapterOptions,
    defineMoostEventHandler,
    getMoostInfact,
} from 'moost'
import {
    WooksCli,
    TWooksCliOptions,
    createCliApp,
    useCliContext,
} from '@wooksjs/event-cli'
import { getCliMate } from './meta-types'
import { CliHelpRenderer, TCliHelpOptions } from '@prostojs/cli-help'
import { setCliHelpForEvent } from './composables'

export interface TCliHandlerMeta {
    path: string
}

export interface TMoostCliOpts {
    /**
     * WooksCli options or instance
     */
    wooksCli?: WooksCli | TWooksCliOptions
    /**
     * CliHelpRenderer options or instance
     */
    cliHelp?: CliHelpRenderer | TCliHelpOptions
    /**
     * more internal logs are printed when true
     */
    debug?: boolean
}

const LOGGER_TITLE = 'moost-cli'
const CONTEXT_TYPE = 'CLI'

/**
 * ## Moost Cli Adapter
 * 
 * Moost Adapter for CLI events
 * 
 * ```ts
 * │  // Quick example
 * │  import { MoostCli, Cli, CliOption, cliHelpInterceptor } from '@moostjs/event-cli'
 * │  import { Moost, Param } from 'moost'
 * │  
 * │  class MyApp extends Moost {
 * │      @Cli('command/:arg')
 * │      command(
 * │         @Param('arg')
 * │         arg: string,
 * │         @CliOption('test', 't')
 * │         test: boolean,
 * │      ) {
 * │          return `command run with flag arg=${ arg }, test=${ test }`
 * │      }
 * │  }
 * │  
 * │  const app = new MyApp()
 * │  app.applyGlobalInterceptors(cliHelpInterceptor())
 * │  
 * │  const cli = new MoostCli()
 * │  app.adapter(cli)
 * │  app.init()
 * ```
 */
export class MoostCli implements TMoostAdapter<TCliHandlerMeta> {
    protected cliApp: WooksCli

    protected cliHelp: CliHelpRenderer

    constructor(protected opts?: TMoostCliOpts) {
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
        if (!opts?.debug) {
            getMoostInfact().silent(true)
        }
    }

    async onNotFound() {
        const pathParams = useCliContext().store('event').get('pathParams')
        const response = await defineMoostEventHandler({
            loggerTitle: LOGGER_TITLE,
            getIterceptorHandler: () => this.moost?.getGlobalInterceptorHandler(),
            getControllerInstance: () => this.moost,
            callControllerMethod: () => undefined,
            logErrors: this.opts?.debug,
            hooks: {
                init: () => setCliHelpForEvent(this.cliHelp),
            },
        })()
        if (typeof response === 'undefined') {
            this.cliApp.onUnknownCommand(pathParams)
        }
        return response
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
            const targetPath = `${opts.prefix.replace(/\s+/g, '/') || ''}/${path}`
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
                    logErrors: this.opts?.debug,
                    hooks: {
                        init: () => setCliHelpForEvent(this.cliHelp),
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
                    value: typeof param.value === 'string' ? param.value : '',
                    description: param.description || '',
                })) || [],
                args,
                aliases: meta?.cliAliases,
            })
            if (this.opts?.debug) {
                opts.logHandler(`${__DYE_CYAN__}(CLI)${ __DYE_GREEN__ }${ targetPath }`)
            }
        }
    }
}
