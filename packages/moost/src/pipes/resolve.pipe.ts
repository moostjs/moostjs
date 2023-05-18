import { TAny } from 'common'
import { TDecoratorLevel } from '../decorators/types'
import { TPipeMetas, TPipePriority } from './types'
import { definePipeFn } from '../define'

export const resolvePipe = definePipeFn((_value, metas, level) => {
    let resolver:
        | ((metas: TPipeMetas<TAny>, level: TDecoratorLevel) => unknown)
        | undefined
    if (level === 'PARAM') {
        resolver = metas.paramMeta?.resolver
    } else if (level === 'PROP') {
        resolver = metas.propMeta?.resolver
    } else if (level === 'METHOD') {
        resolver = metas.methodMeta?.resolver
    } else if (level === 'CLASS') {
        resolver = metas.classMeta?.resolver
    }
    if (resolver) {
        return resolver(metas, level) as Promise<unknown>
    }
    return undefined
}, TPipePriority.RESOLVE)
