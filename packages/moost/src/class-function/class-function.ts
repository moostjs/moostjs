import { getConstructor } from '@prostojs/mate'
import { panic } from 'common'
import { getMoostMate } from '../metadata'
import { getMoostInfact } from '../metadata/infact'
// import { runPipes } from '../pipes/run-pipes'
// import { sharedPipes } from '../pipes/shared-pipes'
import { TAny, TAnyFn, TClassConstructor, TFunction, TObject } from 'common'
import { TCallableClassFunction, TClassFunction } from './types'
import { TPipeData } from '../pipes'

export async function getCallableFn<T extends TAnyFn = TAnyFn>(targetInstance: TObject, fn: TCallableClassFunction<T>, restoreCtx?: TFunction, pipes?: TPipeData[], silent?: boolean): Promise<T> {
    const mate = getMoostMate()
    const meta = mate.read(fn)
    if (meta?.injectable) {
        const infact = getMoostInfact()
        infact.silent(silent || (meta.injectable === 'FOR_EVENT' ? 'logs' : false))
        const instance = await infact.getForInstance(targetInstance, fn as TClassConstructor<TAny>, {
            syncContextFn: () => { restoreCtx && restoreCtx() },
            customData: { pipes: [...(pipes || []), ...(meta.pipes || [])].sort((a, b) => a.priority - b.priority) },
        }) as TClassFunction<T>
        infact.silent(!!silent)
        return ((...args: TAny[]) => {
            return instance.handler(...args as Parameters<T>)
        }) as unknown as T
    }
    if (typeof fn === 'function') {
        return fn as T
    }
    throw panic(`getCallableFn failed for "${ getConstructor(targetInstance).name }" because the passed arg is not a Function nor TClassFunction`)
}
