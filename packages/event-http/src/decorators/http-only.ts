import type { EventContext } from '@wooksjs/event-core'
import { current, eventTypeKey } from '@wooksjs/event-core'
import { httpKind } from '@wooksjs/event-http'

/**
 * Wraps the callback of an HTTP-only interceptor so it runs for HTTP events only (an in-process
 * `MoostHttp.invoke()` included). Any other event of a mixed controller — a CLI command, a
 * workflow step, a WebSocket message — skips it, also when it runs as a child of an HTTP request:
 * the parent's request and response are not its own.
 */
export function forHttpEvents(fn: (ctx: EventContext) => void): () => void {
  return () => {
    const ctx = current()
    if (ctx.has(eventTypeKey) && ctx.get(eventTypeKey) === httpKind.name) {
      fn(ctx)
    }
  }
}
