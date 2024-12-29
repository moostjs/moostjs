import { useRouteParams } from '@wooksjs/event-core'
import type { TEmpty, TObject } from 'common'

import { getMoostMate } from '../metadata/moost-metadata'
import type { TPipeMetas } from '../pipes'
import { Label } from './common.decorator'
import type { TDecoratorLevel } from './types'

/**
 * Hook to the Response Status
 * @decorator
 * @param resolver - resolver function
 * @param label - field label
 * @paramType unknown
 */
export function Resolve<T extends TObject = TEmpty>(
  resolver: (metas: TPipeMetas<T>, level: TDecoratorLevel) => unknown,
  label?: string
): ParameterDecorator & PropertyDecorator {
  return (target, key, index?) => {
    const i = typeof index === 'number' ? index : undefined
    getMoostMate().decorate('resolver', (metas, level) => {
      let newLabel = label
      if (!newLabel && level === 'PROP' && typeof metas.key === 'string') {
        newLabel = metas.key
      }
      fillLabel(target, key || '', i, newLabel)
      return resolver(metas as TPipeMetas<T>, level)
    })(target, key, i!)
  }
}

/**
 * Get Param Value from url parh
 * @decorator
 * @param name - param name
 * @paramType string
 */
export function Param(name: string) {
  return getMoostMate().apply(
    getMoostMate().decorate('paramSource', 'ROUTE'),
    getMoostMate().decorate('paramName', name),
    Resolve(() => useRouteParams().get(name), name)
  )
}

/**
 * Get Parsed Params from url parh
 * @decorator
 * @paramType object
 */
export function Params() {
  return Resolve(() => useRouteParams().params, 'params')
}

/**
 * Provide Const Value
 * @decorator
 * @param value - provided value
 * @param label - label of the field
 * @paramType unknown
 */
export function Const<T>(value: T, label?: string) {
  return Resolve(() => value, label)
}

/**
 * Provide Const Value from Factory fn
 * @decorator
 * @param factory - value Factory fn
 * @param label - label of the field
 * @paramType unknown
 */
export function ConstFactory<T>(factory: () => T | Promise<T>, label?: string) {
  return Resolve(async () => factory(), label)
}

function fillLabel(target: TObject, key: string | symbol, index?: number, name?: string) {
  if (name) {
    const meta = getMoostMate().read(target, key)
    if (typeof index === 'number') {
      if (!meta?.params || !meta.params[index] || !meta.params[index].label) {
        Label(name)(target, key, index)
      }
    } else if (!meta?.label) {
      Label(name)(target, key)
    }
  }
}
