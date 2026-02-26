import type { TClassConstructor, TObject } from './common-types'
import { useControllerContext } from './composables'
import type { TMoostMetadata, TMoostParamsMetadata } from './metadata'
import type { TPipeData } from './pipes'
import { runPipes } from './pipes/run-pipes'
import { isThenable } from './shared-utils'

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
  return () => {
    const args: unknown[] = []
    let hasAsync = false
    for (let i = 0; i < argsPipes.length; i++) {
      const { pipes, meta: paramMeta } = argsPipes[i]
      const result = runPipes(
        pipes,
        undefined,
        {
          classMeta: context.classMeta,
          methodMeta: context.methodMeta,
          paramMeta,
          type: context.type,
          key: context.key,
          index: i,
          targetMeta: paramMeta,
          instantiate: <T extends TObject>(t: TClassConstructor<T>) =>
            useControllerContext().instantiate(t),
        },
        'PARAM',
      )
      if (!hasAsync && isThenable(result)) {
        hasAsync = true
      }
      args[i] = result
    }
    return hasAsync ? Promise.all(args) : args
  }
}
