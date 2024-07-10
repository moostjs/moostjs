import type { TConsoleBase } from '@prostojs/logger'
import type { TObject } from 'common'

import { getCallableFn } from './class-function/class-function'
import type { TInterceptorFn } from './decorators'
import { InterceptorHandler } from './interceptor-handler'
import type { TInterceptorData } from './metadata'
import { getMoostMate } from './metadata'
import type { TPipeData } from './pipes'

const mate = getMoostMate()

export function getIterceptorHandlerFactory(
  interceptors: TInterceptorData[],
  getTargetInstance: () => Promise<TObject>,
  pipes: TPipeData[],
  logger: TConsoleBase
) {
  return () => {
    const interceptorHandlers: TInterceptorFn[] = []
    for (const { handler } of interceptors) {
      const interceptorMeta = mate.read(handler)
      if (interceptorMeta?.injectable) {
        interceptorHandlers.push(async (...args) => {
          const targetInstance = await getTargetInstance()
          return (await getCallableFn(targetInstance, handler, pipes, logger))(...args)
        })
      } else {
        interceptorHandlers.push(handler as TInterceptorFn)
      }
    }
    return Promise.resolve(new InterceptorHandler(interceptorHandlers))
  }
}
