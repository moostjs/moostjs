import type { TDecoratorLevel } from '../decorators/types'
import type { TPipeData, TPipeMetas } from './types'

export async function runPipes(
  pipes: TPipeData[],
  initialValue: unknown,
  metas: TPipeMetas,
  level: TDecoratorLevel
): Promise<unknown> {
  let v = initialValue
  for (const pipe of pipes) {
    v = await pipe.handler(v, metas, level)
  }
  return v
}
