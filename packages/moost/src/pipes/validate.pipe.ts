import { useEventContext } from '@wooksjs/event-core'
import { getMoostValido } from '../metadata/valido'
import { TObject } from 'common'
import { TPipeFn, TPipePriority } from './types'

const DEFAULT_ERROR_LIMIT = 10

function firstString(errors: TObject): string {
    const keys = Object.keys(errors) as (keyof typeof errors)[]
    for (const key of keys) {
        if (typeof errors[key] === 'string') return errors[key]
        return firstString(errors[key])
    }
    return ''
}

interface TValidatePipeOptions {
    errorLimit?: number
    errorCb?: (message: string, details: string | TObject) => unknown
}

export const validatePipe: (opts?: TValidatePipeOptions) => TPipeFn = (
    opts
) => {
    const pipe: TPipeFn = async (_value, metas, level) => {
        const { restoreCtx } = useEventContext()
        const valido = getMoostValido()
        let meta = {}
        if (level === 'PARAM') {
            meta = metas.paramMeta || {}
        } else if (level === 'PROP') {
            meta = metas.propMeta || {}
        } else if (level === 'METHOD') {
            meta = metas.methodMeta || {}
        } else if (level === 'CLASS') {
            meta = metas.classMeta || {}
        }
        const result = await valido.validateParam(
            _value,
            meta,
            metas.key,
            undefined,
            metas.instance,
            undefined,
            0,
            0,
            opts?.errorLimit || DEFAULT_ERROR_LIMIT,
            restoreCtx
        )
        if (result !== true) {
            const message =
                typeof result === 'string' ? result : firstString(result)
            if (opts?.errorCb) {
                opts.errorCb(message, result)
            } else {
                throw new Error('Validation error: ' + message)
            }
        }
        return _value
    }
    pipe.priority = TPipePriority.VALIDATE
    return pipe
}
