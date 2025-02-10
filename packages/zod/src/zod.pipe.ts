/* eslint-disable unicorn/consistent-destructuring */
import type { TPipeFn } from 'moost'
import { definePipeFn, TPipePriority, useEventLogger } from 'moost'
import type { z } from 'zod'

import type { TZodOpts } from './primitives'
import { getZodTypeForProp } from './validate'
import type { TZodMate, TZodMetadata } from './zod.mate'
import { getZodMate } from './zod.mate'
import { TEmpty } from './common-types'

/**
 * Validations pipeline powered by zod
 *
 * @param opts - options object
 *  - formatError: callback to format error
 * @returns Validation Pipeline
 */
export const ZodPipeline = (
  opts?: {
    formatError?: (e: z.ZodError, ...args: Parameters<TPipeFn<TEmpty>>) => Error
  } & TZodOpts
) =>
  definePipeFn<TZodMate>(async (value, metas, level) => {
    const { targetMeta } = metas
    if (
      !targetMeta ||
      targetMeta.zodSkip ||
      metas.classMeta?.zodSkip ||
      metas.methodMeta?.zodSkip ||
      metas.paramMeta?.zodSkip
    ) {
      return value
    }
    const validatableMeta = getZodMate().read(targetMeta.type!)
    if (
      !targetMeta.zodValidate &&
      !validatableMeta?.zodValidate &&
      ![String, Number, Date, Boolean, BigInt].includes(targetMeta.type as StringConstructor)
    ) {
      return value
    }
    const logger = useEventLogger('@moostjs/zod')
    if (targetMeta.zodType || targetMeta.type) {
      const zodType = getZodTypeForProp(
        {
          type: metas.type,
          key: metas.key,
          index: metas.index,
        },
        {
          type: targetMeta.type,
          additionalMeta: targetMeta as TZodMetadata,
        },
        opts,
        logger
      )
      const check = await zodType.spa(value)
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
