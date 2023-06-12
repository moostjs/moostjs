import { TPipeFn, TPipePriority, definePipeFn, useEventContext } from 'moost'
import { getZodMate } from './zod.mate'
import { z } from 'zod'
import { getZodTypeForProp } from './validate'

export const ZodPipeline = (opts?: {
    formatError?: ((e: z.ZodError, ...args: Parameters<TPipeFn>) => Error)
    coerce?: boolean
}) => definePipeFn(async (value, metas, level) => {
    const { restoreCtx } = useEventContext()
    type TMeta = ReturnType<ReturnType<typeof getZodMate>['read']>
    let targetMeta: TMeta = {} as TMeta
    if (level === 'PARAM') {
        targetMeta = (metas.paramMeta || {}) as TMeta
    } else if (level === 'PROP') {
        targetMeta = (metas.propMeta || {}) as TMeta
    } else if (level === 'METHOD') {
        targetMeta = (metas.methodMeta || {}) as TMeta
    } else if (level === 'CLASS') {
        targetMeta = (metas.classMeta || {}) as TMeta
    }
    if (targetMeta.zodType || targetMeta.type) {
        const zodType = getZodTypeForProp({
            type: metas.type,
            key: metas.key,
            index: metas.index,
        }, {
            type: targetMeta.type,
            additionalMeta: targetMeta,
        }, {
            coerce: opts?.coerce || targetMeta.zodCoerce,
        })
        const check = await zodType.spa(value)
        restoreCtx()
        if (check.success) {
            return check.data
        } else {
            if (opts?.formatError) {
                throw opts.formatError(check.error, value, metas, level)
            }
            throw check.error
        }
    }
    return value
}, TPipePriority.VALIDATE)