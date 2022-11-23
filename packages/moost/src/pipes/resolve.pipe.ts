import { TPipeFn, TPipePriority } from './types'

export const resolvePipe: TPipeFn = (_value, meta) => {
    if (meta?.resolver) {
        return meta.resolver() as Promise<unknown>
    }
    return undefined
}

resolvePipe.priority = TPipePriority.RESOLVE
