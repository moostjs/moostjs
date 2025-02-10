import type { TProvideRegistry } from '@prostojs/infact'

import type { TClassConstructor, TFunction, TObject } from '../common-types'
import { getMoostMate } from '../metadata/moost-metadata'
import { insureInjectable } from './injectable.decorator'

/**
 * ## Controller
 * ### @Decorator
 * Set Class as a Controller
 * @param prefix - define the prefix for all the paths of this controller
 */
export function Controller(prefix?: string): ClassDecorator {
  const mate = getMoostMate()
  return mate.apply(insureInjectable, mate.decorate('controller', { prefix: prefix || '' }))
}

/**
 * ## ImportController
 * ### @Decorator
 * Attach sub-controller
 * @param controller - target controller (instance) to import
 * @param provide - provide registry for the target controller
 */
export function ImportController(
  controller: TFunction | TObject,
  provide?: TProvideRegistry
): ClassDecorator

/**
 * ## ImportController
 * ### @Decorator
 * Attach sub-controller
 * @param prefix - redefine the prefix for all the paths of this controller
 * @param controller - point to a controller (instance) to import
 * @param provide - provide registry for the target controller
 */
export function ImportController(
  prefix: string,
  controller: TFunction | TObject,
  provide?: TProvideRegistry
): ClassDecorator

export function ImportController(
  prefix: string | TFunction | TObject,
  controller?: TFunction | TObject | TProvideRegistry,
  provide?: TProvideRegistry
): ClassDecorator {
  return getMoostMate().decorate(
    'importController',
    {
      prefix: typeof prefix === 'string' ? prefix : undefined,
      typeResolver:
        typeof prefix === 'string'
          ? (controller as TClassConstructor)
          : (prefix as TClassConstructor),
      provide:
        typeof prefix === 'string'
          ? provide || undefined
          : (controller as TProvideRegistry) || undefined,
    },
    true
  )
}
