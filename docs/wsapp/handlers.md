# Handlers

::: warning Experimental
This package is in an experimental phase. The API may change without following semver until it reaches a stable release.
:::

Moost WS provides three decorator types for handling WebSocket events: message handlers, connection handlers, and disconnection handlers.

[[toc]]

## Message Handlers

The `@Message` decorator registers a handler for routed WebSocket messages. Each message from the client carries an `event` type and a `path` — the decorator matches on both.

```ts
import { Message, MessageData } from '@moostjs/event-ws'
import { Controller } from 'moost'

@Controller()
export class EchoController {
  @Message('echo', '/echo')
  echo(@MessageData() data: unknown) {
    return data
  }
}
```

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `event` | `string` | The message event type to match (e.g. `"message"`, `"join"`, `"rpc"`) |
| `path` | `string` (optional) | Route path with optional parameters (e.g. `"/chat/:room"`) |

When `path` is omitted, the handler method name is used as the path.

### Return Values

The return value of a message handler is sent back to the client as a reply — but **only** when the client sent a correlation ID (i.e. used `call()` instead of `send()`).

```ts
@Message('query', '/status')
getStatus() {
  return { online: true, uptime: process.uptime() }
}
```

If the client sends `{ event: "query", path: "/status", id: 1 }`, they receive:
```json
{ "id": 1, "data": { "online": true, "uptime": 42.5 } }
```

If the client sends without an `id` (fire-and-forget), the return value is ignored.

### Multiple Events on the Same Path

You can register multiple event types on the same path:

```ts
@Controller('chat')
export class ChatController {
  @Message('join', ':room')
  join(@Param('room') room: string) { /* ... */ }

  @Message('leave', ':room')
  leave(@Param('room') room: string) { /* ... */ }

  @Message('message', ':room')
  message(@Param('room') room: string) { /* ... */ }
}
```

## Connection Handler

The `@Connect` decorator runs when a new WebSocket connection is established. It executes inside the connection context, where you can access the connection ID and HTTP upgrade headers.

```ts
import { Connect, ConnectionId } from '@moostjs/event-ws'
import { useHeaders } from '@wooksjs/event-http'
import { Controller } from 'moost'

@Controller()
export class LifecycleController {
  @Connect()
  onConnect(@ConnectionId() id: string) {
    const headers = useHeaders()
    console.log(`New connection ${id} from ${headers['user-agent']}`)
  }
}
```

::: warning
If the `@Connect` handler throws an error or returns a rejected promise, the connection is closed immediately.
:::

## Disconnection Handler

The `@Disconnect` decorator runs when a WebSocket connection closes. Use it for cleanup tasks like removing user state or notifying other clients.

```ts
import { Disconnect, ConnectionId } from '@moostjs/event-ws'
import { Controller } from 'moost'

@Controller()
export class LifecycleController {
  @Disconnect()
  onDisconnect(@ConnectionId() id: string) {
    console.log(`Connection ${id} closed`)
    // clean up user state, notify others, etc.
  }
}
```

::: tip
Room membership is automatically cleaned up when a connection closes — you don't need to manually leave rooms in the disconnect handler.
:::

## Handler Context

All three handler types participate in the full Moost event lifecycle:

1. **Scope registration** — `FOR_EVENT` scoped instances are created
2. **Interceptor init** — Interceptors can short-circuit the handler
3. **Argument resolution** — Pipes resolve, transform, and validate parameters
4. **Handler execution** — Your method body runs
5. **Interceptor after/onError** — Post-processing or error handling
6. **Scope cleanup** — Event-scoped instances are released

This means you can use all standard Moost features with WebSocket handlers:

```ts
import { Message, MessageData } from '@moostjs/event-ws'
import { Controller, Intercept, Validate } from 'moost'
import { AuthGuard } from './auth.guard'

@Controller('admin')
@Intercept(AuthGuard)
export class AdminController {
  @Message('broadcast', '/announce')
  announce(@MessageData() @Validate() data: AnnounceDto) {
    // protected by AuthGuard and validated
  }
}
```

## One Controller, Multiple Handler Types

A single controller can contain all three handler types alongside regular HTTP handlers (if you're using both adapters):

```ts
@Controller('chat')
export class ChatController {
  @Connect()
  onConnect(@ConnectionId() id: string) { /* ... */ }

  @Disconnect()
  onDisconnect(@ConnectionId() id: string) { /* ... */ }

  @Message('join', ':room')
  join(@Param('room') room: string) { /* ... */ }

  @Message('message', ':room')
  message(@Param('room') room: string) { /* ... */ }
}
```
