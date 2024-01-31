import type { TConsoleBase } from '@prostojs/logger'
import { useEventContext } from '@wooksjs/event-core'
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
          const { restoreCtx } = useEventContext()
          const targetInstance = await getTargetInstance()
          restoreCtx()
          return (await getCallableFn(targetInstance, handler, restoreCtx, pipes, logger))(...args)
        })
      } else {
        interceptorHandlers.push(handler as TInterceptorFn)
      }
    }
    return Promise.resolve(new InterceptorHandler(interceptorHandlers))
  }
}
