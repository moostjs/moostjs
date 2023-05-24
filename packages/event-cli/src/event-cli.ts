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

export interface TCliHandlerMeta {
    path: string
}

export interface TMoostCliOpts {
    /**
     * WooksCli options or instance
     */
    wooksCli?: WooksCli | TWooksCliOptions
    /**
     * more internal logs are printed when true
     */
    debug?: boolean
    /**
     * Array of cli options applicable to every cli command
     */
    globalCliOptions?: { keys: string[], description?: string }[]
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
            const prefix = opts.prefix.replace(/\s+/g, '/') || ''            
            const makePath = (p: string) => `${ prefix }/${p}`
                .replace(/\/\/+/g, '/')
                // avoid interpreting "cmd:tail" as "cmd/:tail"
                .replace(/\/\\:/g, '\\:')
                .replace(/^\/+/g, '')

            if (!fn) {
                fn = defineMoostEventHandler({
                    contextType: CONTEXT_TYPE,
                    loggerTitle: LOGGER_TITLE,
                    getIterceptorHandler: opts.getIterceptorHandler,
                    getControllerInstance: opts.getInstance,
                    controllerMethod: opts.method,
                    resolveArgs: opts.resolveArgs,
                    logErrors: this.opts?.debug,
                })
            }
            const targetPath = makePath(path)
            const meta = getCliMate().read(opts.fakeInstance, opts.method as string)
            const classMeta = getCliMate().read(opts.fakeInstance)

            const cliOptions = new Map<string, { keys: string[], description?: string, value?: string }>()
            ;[
                ...(this.opts?.globalCliOptions?.length ? this.opts.globalCliOptions : []),
                ...(classMeta?.cliOptions || []),
                ...(meta?.params?.filter(param => !!param.cliOptionsKeys && param.cliOptionsKeys.length > 0).map(param => ({
                    keys: param.cliOptionsKeys,
                    value: typeof param.value === 'string' ? param.value : '',
                    description: param.description || '',
                })) || []),
            ].forEach(o => cliOptions.set(o.keys[0], o))
            
            const aliases = []
            if (meta?.cliAliases) {
                for (const alias of meta.cliAliases) {
                    const targetPath = makePath(alias)
                    aliases.push(targetPath)
                }
            }

            const args: Record<string, string> = {}
            meta?.params?.filter(p => p.isRouteParam && p.description)
                .forEach(p => args[p.isRouteParam as string] = p.description as string)

            this.cliApp.cli(targetPath, {
                description: meta?.description || '',
                options: Array.from(cliOptions.values()),
                args,
                aliases,
                examples: meta?.cliExamples || [],
                handler: fn,
                onRegister: (path, aliasType) => {
                    if (this.opts?.debug) {
                        opts.logHandler(`${__DYE_CYAN__}(${ aliasTypes[aliasType] })${__DYE_GREEN__}${path}`)
                    }
                },
            })
        }
    }
}

const aliasTypes = ['CLI', 'CLI-alias', 'CLI-alias*', 'CLI-alias*']
