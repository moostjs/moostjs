import type { TAny, TClassConstructor, TObject } from './common-types'
import type { TInterceptorFn } from './decorators'
import { InterceptorHandler } from './interceptor-handler'
import type { TInterceptorData } from './metadata'
import { getMoostInfact, getMoostMate } from './metadata'
import type { TPipeData } from './pipes'

const mate = getMoostMate()

export function getIterceptorHandlerFactory(
  interceptors: TInterceptorData[],
  getTargetInstance: () => Promise<TObject>,
  pipes: TPipeData[],
) {
  // Precompute handler wrappers at bind time (once per method)
  // instead of rebuilding them on every request
  const precomputedHandlers = interceptors.map<{ handler: TInterceptorFn; name: string }>(
    ({ handler, name }) => {
      const interceptorMeta = mate.read(handler)
      if (interceptorMeta?.injectable) {
        const mergedPipes = [...(pipes || []), ...(interceptorMeta.pipes || [])].toSorted(
          (a, b) => a.priority - b.priority,
        )
        return {
          handler: async (...args: Parameters<TInterceptorFn>) => {
            const targetInstance = await getTargetInstance()
            const instance = (await getMoostInfact().getForInstance(
              targetInstance,
              handler as TClassConstructor<TAny>,
              { customData: { pipes: mergedPipes } },
            )) as { handler: TInterceptorFn }
            return instance.handler(...args)
          },
          name,
        }
      }
      return { handler: handler as TInterceptorFn, name }
    },
  )

  return () => new InterceptorHandler(precomputedHandlers)
}
