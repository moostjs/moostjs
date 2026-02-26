import { useWsConnection, useWsMessage } from '@wooksjs/event-ws'
import { Resolve } from 'moost'

/**
 * Get the parsed WebSocket message payload.
 * Only available in message handlers (@Message).
 * @decorator
 * @paramType T
 */
export function MessageData() {
  return Resolve(() => useWsMessage().data, 'ws_data')
}

/**
 * Get the raw WebSocket message (Buffer or string before parsing).
 * Only available in message handlers (@Message).
 * @decorator
 * @paramType Buffer | string
 */
export function RawMessage() {
  return Resolve(() => useWsMessage().raw, 'ws_raw')
}

/**
 * Get the WebSocket message correlation ID.
 * Only available in message handlers (@Message).
 * @decorator
 * @paramType string | number | undefined
 */
export function MessageId() {
  return Resolve(() => useWsMessage().id, 'ws_message_id')
}

/**
 * Get the WebSocket message event type.
 * Only available in message handlers (@Message).
 * @decorator
 * @paramType string
 */
export function MessageType() {
  return Resolve(() => useWsMessage().event, 'ws_event')
}

/**
 * Get the WebSocket message path.
 * Only available in message handlers (@Message).
 * @decorator
 * @paramType string
 */
export function MessagePath() {
  return Resolve(() => useWsMessage().path, 'ws_path')
}

/**
 * Get the WebSocket connection ID (UUID).
 * Available in all WS handlers (@Message, @Connect, @Disconnect).
 * @decorator
 * @paramType string
 */
export function ConnectionId() {
  return Resolve(() => useWsConnection().id, 'ws_connection_id')
}
