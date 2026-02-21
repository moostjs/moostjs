import { TClassConstructor } from '../common-types'
import { getCliMate } from '../meta-types'

/**
 * ## Define CLI Command
 * ### @MethodDecorator
 *
 * Command path segments may be separated by / or space.
 *
 * For example the folowing path are interpreted the same:
 * - "command test use:dev :name"
 * - "command/test/use:dev/:name"
 *
 * Where name will become an argument
 *
 * @param path - command path
 * @returns
 */
export function Cli(path?: string): MethodDecorator {
  return getCliMate().decorate(
    'handlers',
    { path: path?.replaceAll(/\s+/g, '/'), type: 'CLI' },
    true,
  )
}

/**
 * ## Define CLI Command Alias
 * ### @MethodDecorator
 *
 * Use it to define alias for @Cli('...') command
 *
 * @param path - command alias path
 * @returns
 */
export function CliAlias(alias: string): MethodDecorator {
  return getCliMate().decorate('cliAliases', alias, true)
}

/**
 * ## Define CLI Example
 * ### @MethodDecorator
 *
 * Use it to define example for Cli Help display
 *
 * @param path - command alias path
 * @returns
 */
export function CliExample(cmd: string, description?: string): MethodDecorator {
  return getCliMate().decorate('cliExamples', { cmd, description }, true)
}
