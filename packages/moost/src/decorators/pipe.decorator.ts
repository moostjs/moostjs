import { getMoostMate } from '../metadata/moost-metadata'
import type { TPipeFn } from '../pipes/types'
import { TPipePriority } from '../pipes/types'

/**
 * ## Pipe
 * ### @Decorator
 * Attach pipe
 * @param handler pipe handler
 * @param priority pipe priority
 * @returns
 */
export function Pipe(
  handler: TPipeFn,
  priority?: TPipePriority,
): ClassDecorator & MethodDecorator & ParameterDecorator {
  if (typeof priority !== 'number') {
    priority = typeof handler.priority === 'number' ? handler.priority : TPipePriority.TRANSFORM
  }
  return getMoostMate().decorate('pipes', { handler, priority }, true)
}
