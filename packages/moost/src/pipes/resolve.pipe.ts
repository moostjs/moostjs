import type { TAny } from '../common-types'
import type { TDecoratorLevel } from '../decorators/types'
import { definePipeFn } from '../define'
import type { TPipeMetas } from './types'
import { TPipePriority } from './types'

export const resolvePipe = definePipeFn((_value, metas, level) => {
  const resolver: ((metas: TPipeMetas<TAny>, level: TDecoratorLevel) => unknown) | undefined =
    metas.targetMeta?.resolver

  if (resolver) {
    return resolver(metas, level) as Promise<unknown>
  }
  return undefined
}, TPipePriority.RESOLVE)
