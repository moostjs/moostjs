import { HttpError } from '@wooksjs/event-http'
import { TPipeFn, TPipePriority } from './types'

export const genericTypesCastPipe = (strict?: boolean): TPipeFn => {
    const handler: TPipeFn = (value, meta) => {
        if (meta?.type) {
            if ((value === undefined || value === null || (meta.type !== String && value === '')) && meta.optional) {
                return undefined
            }
            switch (meta.type) {
                case Date: {
                    let d
                    if (typeof value === 'string') {
                        d = new Date(/^\d+$/.test(value) ? Number(value) : value)
                    } else {
                        d = new Date(value as string)
                    }
                    if (strict && Number.isNaN(d.getTime())) {
                        typeError(value, 'Date', meta.label)
                    }
                    return Number.isNaN(d.getTime()) ? value : d
                }
                case Boolean:
                    if ([true, 'true', 'TRUE', 'True', 1, '1', 'X', 'x'].includes(value as string)) {
                        return true
                    }
                    if ([false, 'false', 'FALSE', 'False', 0, '0', '', ' ', null, undefined].includes(value as string)) {
                        return false
                    }
                    if (strict) {
                        typeError(value, 'boolean', meta.label)
                    }
                    return value
                case Number: {
                    if (strict && !value && value !== 0) {
                        typeError(value, 'numeric', meta.label)
                    }
                    const n = typeof value === 'string' && value.length > 0 ? Number(value) : NaN
                    if (strict && Number.isNaN(n)) {
                        typeError(value, 'numeric', meta.label)
                    }
                    return Number.isNaN(n) ? value : n
                }
                case String:
                    if (strict && ['object', 'function'].includes(typeof value)) {
                        typeError(value, 'string', meta.label)
                    }
                    return value && String(value) || value
                default:
                    return value    
            }
        }
    }
    handler.priority = TPipePriority.AFTER_TRANSFORM
    return handler
}

function typeError(value: unknown, targetType: string, label?: string) {
    const prefix = label ? `Argument "${ label }" with value ` : ''
    throw new HttpError(400, `${prefix}${ JSON.stringify(value) } is not a ${ targetType } type`)
}
