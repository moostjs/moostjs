import type { TConsoleBase } from '@prostojs/logger'

import { getCallableFn } from './class-function/class-function'
import type { TObject } from './common-types'
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
    const interceptorHandlers: Array<{ handler: TInterceptorFn; name: string }> = []
    for (const { handler, name } of interceptors) {
      const interceptorMeta = mate.read(handler)
      if (interceptorMeta?.injectable) {
        interceptorHandlers.push({
          handler: async (...args) => {
            const targetInstance = await getTargetInstance()
            return (await getCallableFn(targetInstance, handler, pipes, logger))(...args)
          },
          name,
        })
      } else {
        interceptorHandlers.push({ handler: handler as TInterceptorFn, name })
      }
    }
    return Promise.resolve(new InterceptorHandler(interceptorHandlers))
  }
}
