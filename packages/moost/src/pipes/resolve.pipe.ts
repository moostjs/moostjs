import { TAny } from 'common'
import { TDecoratorLevel } from '../decorators/types'
import { TPipeMetas, TPipePriority } from './types'
import { definePipeFn } from '../define'

export const resolvePipe = definePipeFn((_value, metas, level) => {
    const resolver:
        | ((metas: TPipeMetas<TAny>, level: TDecoratorLevel) => unknown)
        | undefined = metas.targetMeta?.resolver
        
    if (resolver) {
        return resolver(metas, level) as Promise<unknown>
    }
    return undefined
}, TPipePriority.RESOLVE)
