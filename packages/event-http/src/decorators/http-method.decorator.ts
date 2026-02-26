import type { TEmpty, TMoostMetadata } from 'moost'
import { getMoostMate } from 'moost'

/** Base decorator for registering an HTTP route handler with an explicit method. */
export function HttpMethod(
  method: '*' | 'GET' | 'PUT' | 'POST' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS' | 'UPGRADE',
  path?: string,
): MethodDecorator {
  return getMoostMate<TEmpty, TMoostMetadata<{ method: typeof method }>>().decorate(
    'handlers',
    { method, path, type: 'HTTP' },
    true,
  )
}

/** Register a catch-all route handler matching any HTTP method. */
export const All = (path?: string) => HttpMethod('*', path)

/** Register a GET route handler. */
export const Get = (path?: string) => HttpMethod('GET', path)

/** Register a POST route handler. */
export const Post = (path?: string) => HttpMethod('POST', path)

/** Register a PUT route handler. */
export const Put = (path?: string) => HttpMethod('PUT', path)

/** Register a DELETE route handler. */
export const Delete = (path?: string) => HttpMethod('DELETE', path)

/** Register a PATCH route handler. */
export const Patch = (path?: string) => HttpMethod('PATCH', path)

/**
 * Register an UPGRADE route handler for WebSocket upgrade requests.
 *
 * Use together with `WooksWs` (injected via DI) to complete the handshake:
 * ```ts
 * @Upgrade('/ws')
 * handleUpgrade(ws: WooksWs) {
 *   return ws.upgrade()
 * }
 * ```
 */
export const Upgrade = (path?: string) => HttpMethod('UPGRADE', path)
