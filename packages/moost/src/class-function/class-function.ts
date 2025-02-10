import type { TConsoleBase } from '@prostojs/logger'
import { getConstructor } from '@prostojs/mate'

import type { TAny, TAnyFn, TClassConstructor, TObject } from '../common-types'
import { getMoostMate } from '../metadata'
import { getMoostInfact } from '../metadata/infact'
import type { TPipeData } from '../pipes'
import type { TCallableClassFunction, TClassFunction } from './types'

export async function getCallableFn<T extends TAnyFn = TAnyFn>(
  targetInstance: TObject,
  fn: TCallableClassFunction<T>,
  pipes: TPipeData[],
  logger: TConsoleBase
): Promise<T> {
  const mate = getMoostMate()
  const meta = mate.read(fn)
  if (meta?.injectable) {
    const infact = getMoostInfact()
    const instance = (await infact.getForInstance(targetInstance, fn as TClassConstructor<TAny>, {
      customData: {
        pipes: [...(pipes || []), ...(meta.pipes || [])].sort((a, b) => a.priority - b.priority),
      },
    })) as TClassFunction<T>
    return ((...args: TAny[]) => instance.handler(...(args as Parameters<T>))) as unknown as T
  }
  if (typeof fn === 'function') {
    return fn as T
  }
  const e = new Error(
    `getCallableFn failed for "${
      getConstructor(targetInstance).name
    }" because the passed arg is not a Function nor TClassFunction`
  )
  logger.error(e)
  throw e
}
