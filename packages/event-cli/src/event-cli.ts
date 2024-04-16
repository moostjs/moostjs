import type { TWooksCliOptions } from '@wooksjs/event-cli'
import { createCliApp, useCliContext, WooksCli } from '@wooksjs/event-cli'
import type { TFunction } from 'common'
import type { Moost, TMoostAdapter, TMoostAdapterOptions, TMoostParamsMetadata } from 'moost'
import { defineMoostEventHandler, getMoostInfact } from 'moost'

import type { TCliClassMeta } from './meta-types'
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
  globalCliOptions?: Array<{ keys: string[]; description?: string; type?: TFunction }>
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

  protected optionTypes: Record<string, TFunction[]> = {}

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
    const pathParams = useCliContext().store('event').get('pathParams') || []
    const response = await defineMoostEventHandler({
      loggerTitle: LOGGER_TITLE,
      getIterceptorHandler: () => this.moost?.getGlobalInterceptorHandler(),
      getControllerInstance: () => this.moost,
      callControllerMethod: () => undefined,
      logErrors: this.opts?.debug,
    })()
    if (response === undefined) {
      this.cliApp.onUnknownCommand(pathParams)
    }
    return response
  }

  protected moost?: Moost

  onInit(moost: Moost) {
    this.moost = moost
    const boolean = Object.entries(this.optionTypes)
      .filter(([_key, val]) => val.length === 1 && val[0] === Boolean)
      .map(([key, _val]) => key)
    void this.cliApp.run(undefined, {
      boolean,
    })
  }

  bindHandler<T extends object = object>(opts: TMoostAdapterOptions<TCliHandlerMeta, T>): void {
    let fn
    for (const handler of opts.handlers) {
      if (handler.type !== 'CLI') {
        continue
      }
      const path =
        typeof handler.path === 'string'
          ? handler.path
          : typeof opts.method === 'string'
            ? opts.method
            : ''
      const prefix = opts.prefix.replace(/\s+/g, '/') || ''
      const makePath = (p: string) =>
        `${prefix}/${p}`
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
      const cliOptions = new Map<
        string,
        { keys: string[]; description?: string; type?: TFunction; value?: string }
      >()
      ;[
        ...(this.opts?.globalCliOptions?.length ? this.opts.globalCliOptions : []),
        ...(classMeta?.cliOptions || []),
        ...(meta?.params
          ? meta.params
              .filter((param: TCliClassMeta) => param.cliOptionsKeys?.length)
              .map((param: TCliClassMeta & TMoostParamsMetadata) => ({
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                keys: param.cliOptionsKeys!,
                value: typeof param.value === 'string' ? param.value : '',
                description: param.description || '',
                type: param.type,
              }))
          : []),
      ].forEach(o => cliOptions.set(o.keys[0], o))

      const aliases = []
      if (meta?.cliAliases) {
        for (const alias of meta.cliAliases) {
          const targetPath = makePath(alias)
          aliases.push(targetPath)
        }
      }

      const cliOptionsArray = Array.from(cliOptions.values())
      cliOptionsArray.forEach(o => {
        for (const key of o.keys) {
          if (!this.optionTypes[key]) {
            this.optionTypes[key] = []
          }
          if (!this.optionTypes[key].includes(o.type!)) {
            this.optionTypes[key].push(o.type!)
          }
        }
      })

      const args: Record<string, string> = {}
      meta?.params
        .filter(p => p.paramSource === 'ROUTE' && p.description)
        .forEach(p => (args[p.paramName!] = p.description!))

      const routerBinding = this.cliApp.cli(targetPath, {
        description: meta?.description || '',
        options: cliOptionsArray,
        args,
        aliases,
        examples: meta?.cliExamples || [],
        handler: fn,
        // eslint-disable-next-line @typescript-eslint/no-loop-func
        onRegister: (path, aliasType, route) => {
          opts.register(handler, path, route?.getArgs() || routerBinding.getArgs())
          if (this.opts?.debug) {
            opts.logHandler(`${__DYE_CYAN__}(${aliasTypes[aliasType]})${__DYE_GREEN__}${path}`)
          }
        },
      })
      opts.register(handler, targetPath, routerBinding.getArgs())
    }
  }
}

const aliasTypes = ['CLI', 'CLI-alias', 'CLI-alias*', 'CLI-alias*']
