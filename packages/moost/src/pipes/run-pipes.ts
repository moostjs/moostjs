
import { TDecoratorLevel } from '../decorators/types'
import { TFunction } from '../types'
import { TPipeData, TPipeMetas } from './types'

export async function runPipes(pipes: TPipeData[], initialValue: unknown, metas: TPipeMetas, level: TDecoratorLevel, restoreCtx?: TFunction): Promise<unknown> {    
    let v = initialValue
    for (const pipe of pipes) {
        restoreCtx && restoreCtx()
        v = await pipe.handler(v, metas, level)
    }
    return v
}
