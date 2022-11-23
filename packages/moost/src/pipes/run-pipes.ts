
import { TMoostParamsMetadata } from '../metadata'
import { TFunction } from '../types'
import { TPipeData } from './types'

export async function runPipes(pipes: TPipeData[], meta: TMoostParamsMetadata, restoreCtx?: TFunction): Promise<unknown> {    
    let v = undefined
    for (const pipe of pipes) {
        restoreCtx && restoreCtx()
        v = await pipe.handler(v, meta)
    }
    return v
}
