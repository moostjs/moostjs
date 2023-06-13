import { TPipeFn, TPipePriority, definePipeFn, useEventContext } from 'moost'
import { TZodMate, TZodMetadata } from './zod.mate'
import { z } from 'zod'
import { getZodTypeForProp } from './validate'
import { TZodOpts } from './primitives'

/**
 * Validations pipeline powered by zod
 *
 * @param opts - options object
 *  - formatError: callback to format error
 * @returns Validation Pipeline
 */
export const ZodPipeline = (opts?: {
    formatError?: ((e: z.ZodError, ...args: Parameters<TPipeFn>) => Error)
} & TZodOpts) => definePipeFn<TZodMate>(async (value, metas, level) => {
    const { restoreCtx } = useEventContext()
    const { targetMeta } = metas
    if (targetMeta?.zodType || targetMeta?.type) {
        const zodType = getZodTypeForProp({
            type: metas.type,
            key: metas.key,
            index: metas.index,
        }, {
            type: targetMeta.type,
            additionalMeta: targetMeta as TZodMetadata,
        }, opts)
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
