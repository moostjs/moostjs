import { useWsConnection, useWsMessage } from '@wooksjs/event-ws'
import { Resolve } from 'moost'

/**
 * Get the parsed WebSocket message data.
 * Only available in message handlers (@OnMessage).
 * @decorator
 * @paramType T
 */
export function WsData() {
  return Resolve(() => useWsMessage().data, 'ws_data')
}

/**
 * Get the raw WebSocket message (Buffer or string before parsing).
 * Only available in message handlers (@OnMessage).
 * @decorator
 * @paramType Buffer | string
 */
export function WsRawMessage() {
  return Resolve(() => useWsMessage().raw, 'ws_raw')
}

/**
 * Get the WebSocket message correlation ID.
 * Only available in message handlers (@OnMessage).
 * @decorator
 * @paramType string | number | undefined
 */
export function WsMessageId() {
  return Resolve(() => useWsMessage().id, 'ws_message_id')
}

/**
 * Get the WebSocket message event type.
 * Only available in message handlers (@OnMessage).
 * @decorator
 * @paramType string
 */
export function WsEvent() {
  return Resolve(() => useWsMessage().event, 'ws_event')
}

/**
 * Get the WebSocket message path.
 * Only available in message handlers (@OnMessage).
 * @decorator
 * @paramType string
 */
export function WsPath() {
  return Resolve(() => useWsMessage().path, 'ws_path')
}

/**
 * Get the WebSocket connection ID (UUID).
 * Available in all WS handlers (@OnMessage, @OnConnect, @OnDisconnect).
 * @decorator
 * @paramType string
 */
export function WsConnectionId() {
  return Resolve(() => useWsConnection().id, 'ws_connection_id')
}
