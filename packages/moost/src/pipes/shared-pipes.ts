import { resolvePipe } from './resolve.pipe'
import { TPipeData, TPipePriority } from './types'

export const sharedPipes: TPipeData[] = [
    {
        handler: resolvePipe,
        priority: TPipePriority.RESOLVE,
    },
]
