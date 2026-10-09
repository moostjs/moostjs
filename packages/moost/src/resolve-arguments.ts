import type { TClassConstructor, TObject } from './common-types'
import { useControllerContext } from './composables'
import type { TMoostMetadata, TMoostParamsMetadata } from './metadata'
import type { TPipeData, TPipeMetas } from './pipes'
import { runPipes } from './pipes/run-pipes'
import { isThenable } from './shared-utils'

/** `metas.instantiate` of a handler argument: resolves through the current controller's DI. */
const instantiateFromController = <T extends TObject>(t: TClassConstructor<T>) =>
  useControllerContext().instantiate(t)

/**
 * Builds an argument-resolver function from pre-computed per-parameter pipe lists.
 *
 * Returns `undefined` when there are no parameters to resolve.
 * The returned function runs pipes for each parameter and returns
 * `unknown[]` synchronously when possible, or `Promise<unknown[]>` otherwise.
 */
export function resolveArguments(
  argsPipes: { meta: TMoostParamsMetadata; pipes: TPipeData[] }[],
  context: {
    classMeta: TMoostMetadata
    methodMeta: TMoostMetadata
    type: TClassConstructor | Function
    key: string | symbol
  },
): (() => unknown[] | Promise<unknown[]>) | undefined {
  if (argsPipes.length === 0) {
    return undefined
  }
  // The pipe metas of each parameter depend on binding only: built once, shared by every call.
  const params = argsPipes.map(({ meta: paramMeta, pipes }, index) => ({
    pipes,
    metas: {
      classMeta: context.classMeta,
      methodMeta: context.methodMeta,
      paramMeta,
      type: context.type,
      key: context.key,
      index,
      targetMeta: paramMeta,
      instantiate: instantiateFromController,
    } as TPipeMetas,
  }))
  return () => {
    const args: unknown[] = []
    let hasAsync = false
    for (let i = 0; i < params.length; i++) {
      const { pipes, metas } = params[i]
      const result = runPipes(pipes, undefined, metas, 'PARAM')
      if (!hasAsync && isThenable(result)) {
        hasAsync = true
      }
      args[i] = result
    }
    return hasAsync ? Promise.all(args) : args
  }
}
