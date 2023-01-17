import { useRouteParams } from '@wooksjs/event-core'
import { getMoostMate } from '../metadata/moost-metadata'
import { TPipeMetas } from '../pipes'
import { TEmpty, TObject } from '../types'
import { Label } from './common.decorator'
import { TDecoratorLevel } from './types'

/**
 * Hook to the Response Status
 * @decorator
 * @param resolver - resolver function
 * @param label - field label
 * @paramType unknown
 */
export function Resolve<T extends TObject = TEmpty>(resolver: (metas: TPipeMetas<T>, level: TDecoratorLevel) => unknown, label?: string): ParameterDecorator & PropertyDecorator {
    return (target, key, index?) => {
        const i = typeof index === 'number' ? index : undefined
        fillLabel(target, key, i, label)
        getMoostMate().decorate('resolver', resolver)(target, key, i as number)
    }
}

/**
 * Get Param Value from url parh
 * @decorator
 * @param name - param name
 * @paramType string
 */
export function Param(name: string) {
    return Resolve(() => useRouteParams().get(name), name)
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
export function Const(value: unknown, label?: string) {
    return Resolve(() => value, label)
}

function fillLabel(target: TObject, key: string | symbol, index?: number, name?: string) {
    if (name) {
        const meta = getMoostMate().read(target, key)
        if (typeof index === 'number') {
            if (!meta?.params || !meta?.params[index] || !meta?.params[index].label) {
                Label(name)(target, key, index)
            }
        } else {
            if (!meta?.label) {
                Label(name)(target, key)
            }
        }
    }
}
