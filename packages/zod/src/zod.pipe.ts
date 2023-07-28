import { TPipeFn, TPipePriority, definePipeFn, useEventContext } from 'moost'
import { TZodMate, TZodMetadata, getZodMate } from './zod.mate'
import { z } from 'zod'
import { getZodTypeForProp } from './validate'
import { TZodOpts } from './primitives'
import { useEventLogger } from 'moost'
import { TFunction } from 'common'

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
    const { targetMeta } = metas
    if (!targetMeta ||
        targetMeta?.zodSkip ||
        metas.classMeta?.zodSkip ||
        metas.methodMeta?.zodSkip ||
        metas.paramMeta?.zodSkip
    ) return value
    const validatableMeta = getZodMate().read(targetMeta.type as TFunction)
    if (!targetMeta.zodValidate &&
        !validatableMeta?.zodValidate &&
        ![String, Number, Date, Boolean, BigInt].includes(targetMeta.type as StringConstructor)
    ) return value
    const { restoreCtx } = useEventContext()
    const logger = useEventLogger('@moostjs/zod')
    if (targetMeta?.zodType || targetMeta?.type) {
        const zodType = getZodTypeForProp({
            type: metas.type,
            key: metas.key,
            index: metas.index,
        }, {
            type: targetMeta.type,
            additionalMeta: targetMeta as TZodMetadata,
        }, opts, logger)
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
