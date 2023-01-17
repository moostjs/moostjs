import { HttpError, useHttpContext } from '@wooksjs/event-http'
import { getMoostValido } from '../metadata/valido'
import { TObject } from '../types'
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
}

export const validatePipe: (opts?: TValidatePipeOptions) => TPipeFn = (opts) => {
    const pipe: TPipeFn = async (_value, meta) => {
        const { restoreCtx } = useHttpContext()
        const valido = getMoostValido()
        const result = await valido.validateParam(_value, meta.paramMeta || {}, undefined, undefined, undefined, undefined, 0, 0, opts?.errorLimit || DEFAULT_ERROR_LIMIT, restoreCtx)
        if (result !== true) {
            throw new HttpError<{
                statusCode: number
                message: string
                error: string
                details: string | TObject
            }>(400, {
                statusCode: 400,
                message: typeof result === 'string' ? result : firstString(result),
                error: 'Validation Error',
                details: result,
            })
        }
        return _value
    }
    pipe.priority = TPipePriority.VALIDATE
    return pipe
}

