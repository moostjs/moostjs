import { Moost } from 'moost'
import type { TMoostCliOpts } from './event-cli'
import { MoostCli } from './event-cli'
import { cliHelpInterceptor } from './interceptors'

interface THelpOptions {
  name?: string
  title?: string
  maxWidth?: number
  maxLeft?: number
  mark?: string
  colors?: boolean
  lookupLevel?: number
}

/**
 * Quick CLI App factory class.
 *
 * Use this class to quickly build a CLI application with controllers, help options,
 * and global CLI options. It extends the Moost class and wraps the initialization of MoostCli.
 *
 * @example
 * ```typescript
 * import { CliApp } from '@wooksjs/event-cli'
 * import { Commands } from './commands.controller.ts'
 * new CliApp()
 *  .controllers(Commands)
 *  .useHelp({ name: 'myCli' })
 *  .useOptions([{ keys: ['help'], description: 'Display instructions for the command.' }])
 *  .start()
 * ```
 */
export class CliApp extends Moost {
  protected _helpOpts?: THelpOptions

  protected _globalOpts?: TMoostCliOpts['globalCliOptions']

  /**
   * Registers one or more CLI controllers.
   *
   * (Shortcut for `registerControllers` method.)
   *
   * @param {...(object|Function|[string, object|Function])} controllers - List of controllers.
   *   Each controller can be an object, a class, or a tuple with a name and the controller.
   * @returns {this} The CliApp instance for method chaining.
   */
  controllers(...controllers: (object | Function | [string, object | Function])[]) {
    return this.registerControllers(...controllers)
  }

  /**
   * Configures the CLI help options.
   *
   * This method sets the help options for the CLI. It ensures that colored output is enabled
   * (unless explicitly disabled) and that the lookup level defaults to 3 if not provided.
   *
   * @param {THelpOptions} helpOpts - Help options configuration.
   * @param {boolean} helpOpts.colors - Enable colored output.
   * @param {number} helpOpts.lookupLevel - Level for help lookup.
   * @returns {this} The CliApp instance for method chaining.
   */
  useHelp(helpOpts: THelpOptions) {
    this._helpOpts = helpOpts
    if (this._helpOpts.colors !== false) {
      this._helpOpts.colors = true
    }
    if (typeof this._helpOpts.lookupLevel !== 'number') {
      this._helpOpts.lookupLevel = 3
    }
    return this
  }

  /**
   * Sets the global CLI options.
   *
   * @param {TMoostCliOpts['globalCliOptions']} globalOpts - Global options for the CLI.
   * @returns {this} The CliApp instance for method chaining.
   */
  useOptions(globalOpts: TMoostCliOpts['globalCliOptions']) {
    this._globalOpts = globalOpts
    return this
  }

  /**
   * Starts the CLI application.
   *
   * This method creates a MoostCli instance using the configured help and global options,
   * attaches it via the adapter, applies the CLI help interceptor (if help options are set),
   * and then initializes the application.
   *
   * @returns {any} The result of the initialization process.
   */
  start() {
    const cli = new MoostCli({
      wooksCli: {
        cliHelp: this._helpOpts
          ? {
              name: this._helpOpts.name,
              title: this._helpOpts.title,
              maxWidth: this._helpOpts.maxWidth,
              maxLeft: this._helpOpts.maxLeft,
              mark: this._helpOpts.mark,
            }
          : undefined,
      },
      globalCliOptions: this._globalOpts,
    })
    this.adapter(cli)
    if (this._helpOpts) {
      this.applyGlobalInterceptors(
        cliHelpInterceptor({
          colors: this._helpOpts.colors,
          lookupLevel: this._helpOpts.lookupLevel,
        }),
      )
    }
    return this.init()
  }
}
