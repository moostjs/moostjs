import type { TGetHandlerPathsOptions } from '../handler-paths'
import { useHandlerPaths } from '../handler-paths'
import { Resolve } from './resolve.decorator'

/**
 * ## HandlerPaths
 * ### @Decorator
 * Injects the actual mounted path(s) (`string[]`) of a handler method on the
 * current controller, read from the post-bind overview. Built for `@MoostInit`
 * method parameters:
 *
 * ```ts
 * @MoostInit()
 * init(@HandlerPaths('refresh') paths: string[]) {
 *   const path = paths[0] // e.g. '/api/auth/refresh'
 * }
 * ```
 *
 * `method` defaults to the current context method (useful inside event handlers);
 * pass it explicitly in `@MoostInit`, where the current method is the init method,
 * not the handler. Returns all distinct paths — see {@link useHandlerPaths}.
 */
export function HandlerPaths(method?: string, opts?: TGetHandlerPathsOptions) {
  return Resolve(() => useHandlerPaths(method, opts))
}
