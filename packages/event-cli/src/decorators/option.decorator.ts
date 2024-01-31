import { useCliOption } from '@wooksjs/event-cli'
import { Resolve } from 'moost'

import { getCliMate } from '../meta-types'
import { formatParams } from '../utils'

/**
 * ## Define CLI Option
 * ### @ParameterDecorator
 * Use together with @Description('...') to document cli option
 *
 * ```ts
 * │   @Cli('command')
 * │   command(
 * │      @Description('Test option...')
 * │      @CliOption('test', 't')
 * │      test: boolean,
 * │   ) {
 * │       return `test=${ test }`
 * │   }
 * ```
 *
 * @param keys list of keys (short and long alternatives)
 * @returns
 */
export function CliOption(...keys: string[]): ParameterDecorator {
  const mate = getCliMate()
  return mate.apply(
    mate.decorate('cliOptionsKeys', keys, false),
    Resolve(() => useCliOption(keys[0]), formatParams(keys).join(', '))
  )
}

/**
 * ## Define Global CLI Option
 * ### @ClassDecorator
 * The option described here will appear in every command instructions
 * @param option keys and description of CLI option
 * @returns
 */
export function CliGlobalOption(option: {
  keys: string[]
  description?: string
  value?: string
}): ClassDecorator {
  const mate = getCliMate()
  return mate.decorate('cliOptions', option, true)
}
