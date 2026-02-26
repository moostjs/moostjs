# Request Data

::: warning Experimental
This package is in an experimental phase. The API may change without following semver until it reaches a stable release.
:::

Moost WS provides resolver decorators to extract data from WebSocket messages and connections.
These decorators can be applied to handler method arguments.

Additionally, you can use composable functions from Wooks directly inside handlers.
For details, see the [Wooks WS Composables](https://wooks.moost.org/wsapp/composables.html) documentation.

::: info
To learn more about the foundation of resolver decorators, read the [Moost Resolvers Documentation](/moost/pipes/resolve).
:::

[[toc]]

## Message Data

### MessageData

The `@MessageData` decorator resolves the parsed message payload. This is the `data` field from the client message after JSON parsing.

```ts
import { Message, MessageData } from '@moostjs/event-ws'
import { Controller } from 'moost'

@Controller()
export class ChatController {
  @Message('message', '/chat/:room')
  onMessage(@MessageData() data: { from: string; text: string }) { // [!code focus]
    console.log(`${data.from}: ${data.text}`)
  }
}
```

Only available in `@Message` handlers.

### RawMessage

The `@RawMessage` decorator resolves the raw message before JSON parsing — a `Buffer` or `string`.

```ts
import { Message, RawMessage } from '@moostjs/event-ws'
import { Controller } from 'moost'

@Controller()
export class DebugController {
  @Message('debug', '/raw')
  onRaw(@RawMessage() raw: Buffer | string) { // [!code focus]
    console.log('Raw message:', raw.toString())
  }
}
```

Only available in `@Message` handlers.

### MessageId

The `@MessageId` decorator resolves the message correlation ID. This is `undefined` for fire-and-forget messages and a `string | number` for RPC calls.

```ts
import { Message, MessageId, MessageData } from '@moostjs/event-ws'
import { Controller } from 'moost'

@Controller()
export class RpcController {
  @Message('query', '/info')
  info(
    @MessageId() messageId: string | number | undefined, // [!code focus]
    @MessageData() data: unknown,
  ) {
    console.log('Correlation ID:', messageId)
    return { timestamp: Date.now() }
  }
}
```

Only available in `@Message` handlers.

### MessageType

The `@MessageType` decorator resolves the event type string from the message.

```ts
import { Message, MessageType } from '@moostjs/event-ws'
import { Controller } from 'moost'

@Controller()
export class LogController {
  @Message('*', '/log')
  onAny(@MessageType() event: string) { // [!code focus]
    console.log('Event type:', event)
  }
}
```

Only available in `@Message` handlers.

### MessagePath

The `@MessagePath` decorator resolves the concrete message path (after routing).

```ts
import { Message, MessagePath } from '@moostjs/event-ws'
import { Controller } from 'moost'

@Controller()
export class LogController {
  @Message('action', '/game/:id')
  onAction(@MessagePath() path: string) { // [!code focus]
    console.log('Message path:', path) // e.g. "/game/42"
  }
}
```

Only available in `@Message` handlers.

## Connection Info

### ConnectionId

The `@ConnectionId` decorator resolves the unique connection identifier (UUID). Available in **all** WebSocket handler types — message, connect, and disconnect.

```ts
import { Message, Connect, Disconnect, ConnectionId } from '@moostjs/event-ws'
import { Controller } from 'moost'

@Controller()
export class TrackingController {
  @Connect()
  onConnect(@ConnectionId() id: string) { // [!code focus]
    console.log(`Connected: ${id}`)
  }

  @Message('ping', '/ping')
  ping(@ConnectionId() id: string) { // [!code focus]
    return { pong: true, connectionId: id }
  }

  @Disconnect()
  onDisconnect(@ConnectionId() id: string) { // [!code focus]
    console.log(`Disconnected: ${id}`)
  }
}
```

## Route Parameters

### Param

The `@Param` decorator resolves named route parameters from the message path. This is the same decorator used in HTTP routing.

```ts
import { Message, MessageData } from '@moostjs/event-ws'
import { Controller, Param } from 'moost'

@Controller('chat')
export class ChatController {
  @Message('message', ':room')
  onMessage(
    @Param('room') room: string, // [!code focus]
    @MessageData() data: { text: string },
  ) {
    console.log(`[${room}] ${data.text}`)
  }
}
```

For a message with path `/chat/general`, `room` resolves to `"general"`.

### Params

Use `@Params()` to get all route parameters as an object:

```ts
import { Message } from '@moostjs/event-ws'
import { Controller, Params } from 'moost'

@Controller()
export class GameController {
  @Message('move', '/game/:gameId/player/:playerId')
  onMove(@Params() params: { gameId: string; playerId: string }) { // [!code focus]
    console.log(params) // { gameId: '1', playerId: 'alice' }
  }
}
```

## HTTP Context in WebSocket Handlers

When using HTTP-integrated mode, the original HTTP upgrade request context is available in WebSocket handlers through the parent event context chain. You can access HTTP composables like `useHeaders`, `useRequest`, and `useCookies`:

```ts
import { Connect, ConnectionId } from '@moostjs/event-ws'
import { useHeaders, useRequest } from '@wooksjs/event-http'
import { Controller } from 'moost'

@Controller()
export class ConnectionController {
  @Connect()
  onConnect(@ConnectionId() id: string) {
    const { url } = useRequest()
    const headers = useHeaders()

    console.log('Upgrade URL:', url)
    console.log('User-Agent:', headers['user-agent'])
    console.log('Origin:', headers.origin)
  }
}
```

::: tip
HTTP composables read from the upgrade request that initiated the WebSocket connection. They are read-only — response composables like `useResponse()` are not available in WS handlers.
:::

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
