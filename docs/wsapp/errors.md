# Error Handling


Moost WS uses `WsError` for structured error responses. When a message handler throws a `WsError` while processing an RPC message (a message sent with a correlation `id`), the server sends an error reply to the client with the specified code and message.

::: warning Replies require an `id`
Error replies — including the automatic 404/500 ones — are only delivered for RPC messages. A `WsError` thrown while handling a fire-and-forget message (no `id`) is silently dropped: no reply, no server log.
:::

[[toc]]

## WsError

`WsError` is the WebSocket equivalent of `HttpError`. It carries a numeric error code and a message string.

```ts
import { WsError } from '@moostjs/event-ws'

throw new WsError(400, 'Name is required')
throw new WsError(401, 'Unauthorized')
throw new WsError(409, 'Name already taken')
```

### In Message Handlers

```ts
import { Message, MessageData, ConnectionId } from '@moostjs/event-ws'
import { WsError } from '@moostjs/event-ws'
import { Controller, Param } from 'moost'

@Controller('chat')
export class ChatController {
  @Message('join', ':room')
  join(
    @ConnectionId() id: string,
    @MessageData() data: { name: string },
  ) {
    if (!data?.name || data.name.trim().length === 0) {
      throw new WsError(400, 'Name is required') // [!code focus]
    }

    if (isNameTaken(data.name, id)) {
      throw new WsError(409, `Name "${data.name}" is already taken`) // [!code focus]
    }

    // ... join logic
  }
}
```

When the client sent the message with an `id` (RPC), they receive:
```json
{ "id": 1, "error": { "code": 409, "message": "Name \"Alice\" is already taken" } }
```

### In Upgrade Handlers

Throwing in an `@Upgrade` handler rejects the WebSocket connection:

```ts
import { Upgrade } from '@moostjs/event-http'
import { WsError } from '@moostjs/event-ws'
import { useHeaders } from '@wooksjs/event-http'

@Upgrade('ws/admin')
upgradeAdmin() {
  const headers = useHeaders()
  if (headers.authorization !== 'Bearer admin-secret') {
    throw new WsError(401, 'Unauthorized') // [!code focus]
  }
  return this.ws.upgrade()
}
```

::: warning
When an upgrade handler throws, the raw socket is destroyed without an HTTP response — the client sees a failed WebSocket handshake, not the error code or message. The `WsError` code/message are server-side only here. To send the client a structured close reason, throw in a `@Connect` handler instead.
:::

### In Connect Handlers

Throwing in a `@Connect` handler closes the connection with a WebSocket close frame — close code `1008` for `WsError(401)`/`WsError(403)`, `1011` otherwise, with the error message as the close reason:

```ts
@Connect()
onConnect(@ConnectionId() id: string) {
  if (tooManyConnections()) {
    throw new WsError(503, 'Server at capacity') // [!code focus]
    // client receives close code 1011, reason "Server at capacity"
  }
}
```

## Error Codes

You can use any numeric code. Common conventions:

| Code | Meaning |
|------|---------|
| 400 | Bad request / validation error |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not found (auto-sent for unmatched routes) |
| 409 | Conflict |
| 429 | Too many requests |
| 500 | Internal server error (auto-sent for unhandled exceptions) |
| 503 | Service unavailable |

## Unhandled Errors

If a handler throws a non-`WsError` exception, the server:

1. Logs the error server-side
2. Sends a generic `500` error reply (for RPC messages):
```json
{ "id": 1, "error": { "code": 500, "message": "Internal Error" } }
```

The actual error details are **not** exposed to the client for security.

## Using Interceptors for Error Handling

You can use Moost's interceptor system to create centralized error handling:

```ts
import { Controller, defineErrorInterceptor, Intercept, TInterceptorPriority } from 'moost'

const wsErrorHandler = defineErrorInterceptor((error, reply) => {
  // log, transform, or suppress errors
  console.error('WS handler error:', error)
}, TInterceptorPriority.CATCH_ERROR)

@Controller('chat')
@Intercept(wsErrorHandler)
export class ChatController {
  // ...
}
```

For convenience, `@moostjs/event-ws` re-exports `defineInterceptor`, `defineBeforeInterceptor`, and `defineAfterInterceptor` from `moost`, so WS-focused modules can define interceptors without an extra import. See [Interceptors](/moost/interceptors) for the full guide.

## Client-Side Error Handling

On the client, use `WsClientError` to handle RPC errors:

```ts
import { WsClientError } from '@wooksjs/ws-client'

try {
  await client.call('join', '/chat/general', { name: 'Alice' })
} catch (err) {
  if (err instanceof WsClientError) {
    console.log(`Error ${err.code}: ${err.message}`)
  }
}
```

See the [client documentation](./client) and the [Wooks WS client reference](https://wooks.moost.org/wsapp/client.html) for more details.
