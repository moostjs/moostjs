import type { TEmpty, TMoostMetadata } from 'moost'
import { getMoostMate } from 'moost'

/**
 * ## Define WebSocket Message Handler
 * ### @MethodDecorator
 *
 * Registers a handler for routed WebSocket messages.
 * The event and path correspond to the WsClientMessage protocol fields.
 *
 * @param event - message event type (e.g. "message", "rpc", "subscribe")
 * @param path - route path with optional params (e.g. "/chat/rooms/:roomId")
 */
export function Message(event: string, path?: string): MethodDecorator {
  return getMoostMate<TEmpty, TMoostMetadata<{ event: string; method: string }>>().decorate(
    'handlers',
    { event, path, type: 'WS_MESSAGE' },
    true,
  )
}

/**
 * ## Define WebSocket Connection Handler
 * ### @MethodDecorator
 *
 * Registers a handler that runs when a new WebSocket connection is established.
 * Runs inside the connection context. Throwing or rejecting closes the connection.
 */
export function Connect(): MethodDecorator {
  return getMoostMate<TEmpty, TMoostMetadata>().decorate('handlers', { type: 'WS_CONNECT' }, true)
}

/**
 * ## Define WebSocket Disconnection Handler
 * ### @MethodDecorator
 *
 * Registers a handler that runs when a WebSocket connection closes.
 */
export function Disconnect(): MethodDecorator {
  return getMoostMate<TEmpty, TMoostMetadata>().decorate(
    'handlers',
    { type: 'WS_DISCONNECT' },
    true,
  )
}
