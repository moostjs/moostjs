# Request data — @moostjs/event-ws

> Resolver decorators for extracting message data, connection info, and route parameters from WebSocket events.

## Concepts

Moost WS provides parameter decorators that resolve values from the WebSocket event context. These decorators are applied to handler method arguments and participate in the Moost pipes pipeline (resolve, transform, validate).

There are two categories:
- **Message decorators** — only available in `@Message` handlers
- **Connection decorators** — available in all handler types (`@Message`, `@Connect`, `@Disconnect`)

Additionally, Wooks composable functions (`useWsMessage()`, `useWsConnection()`, etc.) can be called directly inside handler bodies.

## API Reference

### `@MessageData()`

Resolves the parsed message payload (the `data` field from the client message).

```ts
@Message('message', '/chat/:room')
onMessage(@MessageData() data: { from: string; text: string }) {
  console.log(`${data.from}: ${data.text}`)
}
```

**Returns:** `unknown` (typed by the parameter's type annotation)
**Available in:** `@Message` only

### `@RawMessage()`

Resolves the raw message before JSON parsing.

```ts
@Message('debug', '/raw')
onRaw(@RawMessage() raw: Buffer | string) {
  console.log('Raw message:', raw.toString())
}
```

**Returns:** `Buffer | string`
**Available in:** `@Message` only

### `@MessageId()`

Resolves the message correlation ID. `undefined` for fire-and-forget, `string | number` for RPC calls.

```ts
@Message('query', '/info')
info(@MessageId() messageId: string | number | undefined) {
  console.log('Correlation ID:', messageId)
  return { timestamp: Date.now() }
}
```

**Returns:** `string | number | undefined`
**Available in:** `@Message` only

### `@MessageType()`

Resolves the event type string from the message.

```ts
@Message('*', '/log')
onAny(@MessageType() event: string) {
  console.log('Event type:', event)
}
```

**Returns:** `string`
**Available in:** `@Message` only

### `@MessagePath()`

Resolves the concrete message path (after routing).

```ts
@Message('action', '/game/:id')
onAction(@MessagePath() path: string) {
  console.log('Message path:', path) // e.g. "/game/42"
}
```

**Returns:** `string`
**Available in:** `@Message` only

### `@ConnectionId()`

Resolves the unique connection identifier (UUID).

```ts
@Connect()
onConnect(@ConnectionId() id: string) {
  console.log(`Connected: ${id}`)
}

@Message('ping', '/ping')
ping(@ConnectionId() id: string) {
  return { pong: true, connectionId: id }
}

@Disconnect()
onDisconnect(@ConnectionId() id: string) {
  console.log(`Disconnected: ${id}`)
}
```

**Returns:** `string`
**Available in:** All handlers (`@Message`, `@Connect`, `@Disconnect`)

### `@Param(name: string)`

Resolves a named route parameter from the message path. Same decorator as HTTP routing (re-exported from `moost`).

```ts
@Message('message', ':room')
onMessage(@Param('room') room: string, @MessageData() data: { text: string }) {
  console.log(`[${room}] ${data.text}`)
}
```

**Returns:** `string`
**Available in:** `@Message` only

### `@Params()`

Resolves all route parameters as an object. Re-exported from `moost`.

```ts
@Message('move', '/game/:gameId/player/:playerId')
onMove(@Params() params: { gameId: string; playerId: string }) {
  console.log(params) // { gameId: '1', playerId: 'alice' }
}
```

**Returns:** `Record<string, string>`
**Available in:** `@Message` only

## Using Composables Directly

You can also call Wooks composables inside handler bodies instead of using decorators:

```ts
import { useWsMessage, useWsConnection } from '@moostjs/event-ws'

@Message('echo', '/echo')
echo() {
  const { data, id, path, event } = useWsMessage()
  const { id: connId, send } = useWsConnection()
  return data
}
```

## HTTP Context in WS Handlers

In HTTP-integrated mode, HTTP composables from the upgrade request are available:

```ts
import { Connect, ConnectionId } from '@moostjs/event-ws'
import { useHeaders, useRequest } from '@wooksjs/event-http'

@Connect()
onConnect(@ConnectionId() id: string) {
  const { url } = useRequest()
  const headers = useHeaders()
  console.log('Upgrade URL:', url)
  console.log('User-Agent:', headers['user-agent'])
}
```

HTTP composables are read-only — response composables like `useResponse()` are not available in WS handlers.

## Summary

| Decorator | Returns | Available In |
|-----------|---------|-------------|
| `@MessageData()` | Parsed message payload | `@Message` |
| `@RawMessage()` | Raw `Buffer \| string` | `@Message` |
| `@MessageId()` | Correlation ID `string \| number \| undefined` | `@Message` |
| `@MessageType()` | Event type `string` | `@Message` |
| `@MessagePath()` | Concrete message path `string` | `@Message` |
| `@ConnectionId()` | Connection UUID `string` | All handlers |
| `@Param(name)` | Named route parameter `string` | `@Message` |
| `@Params()` | All route parameters `object` | `@Message` |
