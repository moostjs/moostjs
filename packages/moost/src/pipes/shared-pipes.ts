import { resolvePipe } from './resolve.pipe'
import type { TPipeData } from './types'
import { TPipePriority } from './types'

export const sharedPipes: TPipeData[] = [
  {
    handler: resolvePipe,
    priority: TPipePriority.RESOLVE,
  },
]
