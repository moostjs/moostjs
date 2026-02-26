import type { TDecoratorLevel } from '../decorators/types'
import type { TPipeData, TPipeMetas } from './types'

export function runPipes(
  pipes: TPipeData[],
  initialValue: unknown,
  metas: TPipeMetas,
  level: TDecoratorLevel,
): unknown {
  let v = initialValue
  for (let i = 0; i < pipes.length; i++) {
    const result = pipes[i].handler(v, metas, level)
    if (result && typeof (result as PromiseLike<unknown>).then === 'function') {
      // Encountered an async pipe — fall back to async loop for remaining pipes
      return (async () => {
        v = await result
        for (let j = i + 1; j < pipes.length; j++) {
          v = await pipes[j].handler(v, metas, level)
        }
        return v
      })()
    }
    v = result
  }
  return v
}
