import { getConstructor } from '@prostojs/mate'
import { panic } from 'common/panic'
import { getMoostMate } from '../metadata'
import { getMoostInfact } from '../metadata/infact'
// import { runPipes } from '../pipes/run-pipes'
// import { sharedPipes } from '../pipes/shared-pipes'
import { TAny, TAnyFn, TClassConstructor, TFunction, TObject } from '../types'
import { TCallableClassFunction, TClassFunction } from './types'

export async function getCallableFn<T extends TAnyFn = TAnyFn>(targetInstance: TObject, fn: TCallableClassFunction<T>, restoreCtx?: TFunction): Promise<T> {
    const mate = getMoostMate()
    const meta = mate.read(fn)
    if (meta?.injectable) {
        const infact = getMoostInfact()
        infact.silent(meta.injectable === 'FOR_EVENT')
        const instance = await infact.getForInstance(targetInstance, fn as TClassConstructor, [], () => { restoreCtx && restoreCtx() }) as TClassFunction<T>
        infact.silent(false)
        return ((...args: TAny[]) => {
            return instance.handler(...args as Parameters<T>)
        }) as unknown as T
    }
    if (typeof fn === 'function') {
        return fn as T
    }
    throw panic(`getCallableFn failed for "${ getConstructor(targetInstance).name }" because the passed arg is not a Function nor TClassFunction`)
}
