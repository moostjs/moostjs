import { useAutoHelp, useCommandLookupHelp } from '@wooksjs/event-cli'
import { defineInterceptorFn, Intercept, TInterceptorPriority, useControllerContext } from 'moost'

/**
 * ### Interceptor Factory for CliHelpRenderer
 *
 * By default intercepts cli calls with flag --help
 * and prints help.
 *
 * ```js
 * new Moost().applyGlobalInterceptors(cliHelpInterceptor({ colors: true }))
 * ```
 * @param opts {} { helpOptions: ['help', 'h'], colors: true } cli options to invoke help renderer
 * @returns TInterceptorFn
 */
export const cliHelpInterceptor = (opts?: {
  /**
   * CLI Options that invoke help
   * ```js
   * helpOptions: ['help', 'h']
   * ```
   */
  helpOptions?: string[]
  /**
   * Enable colored help
   */
  colors?: boolean
  /**
   * Enable lookup for a command
   */
  lookupLevel?: number
}) =>
  defineInterceptorFn(() => {
    try {
      if (useAutoHelp(opts?.helpOptions, opts?.colors)) {
        return ''
      }
    } catch (error) {
      //
    }
    if (opts?.lookupLevel) {
      const { getMethod } = useControllerContext()
      if (!getMethod()) {
        useCommandLookupHelp(opts.lookupLevel)
      }
    }
  }, TInterceptorPriority.BEFORE_ALL)

/**
 * ## @Decorator
 * ### Interceptor Factory for CliHelpRenderer
 *
 * By default intercepts cli calls with flag --help
 * and prints help.
 *
 * ```ts
 * // default configuration
 * • @CliHelpInterceptor({ helpOptions: 'help', colors: true })
 *
 * // additional option -h to invoke help renderer
 * • @CliHelpInterceptor({ helpOptions: ['help', 'h'], colors: true })
 *
 * // redefine cli option to invoke help renderer
 * • @CliHelpInterceptor({ helpOptions: ['usage'] })
 * ```
 *
 * @param opts {} { helpOptions: ['help', 'h'], colors: true } cli options to invoke help renderer
 * @returns Decorator
 */
export const CliHelpInterceptor = (...opts: Parameters<typeof cliHelpInterceptor>) =>
  Intercept(cliHelpInterceptor(...opts))
