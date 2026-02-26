# Error Handling

::: warning Experimental
This package is in an experimental phase. The API may change without following semver until it reaches a stable release.
:::

Moost WS uses `WsError` for structured error responses. When a handler throws a `WsError`, the server sends an error reply to the client with the specified code and message.

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

`WsError` can also be thrown in `@Upgrade` handlers to reject WebSocket connections:

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

### In Connect Handlers

Throwing in a `@Connect` handler closes the connection:

```ts
@Connect()
onConnect(@ConnectionId() id: string) {
  if (tooManyConnections()) {
    throw new WsError(503, 'Server at capacity') // [!code focus]
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
import { defineInterceptorFn } from 'moost'

const wsErrorHandler = defineInterceptorFn({
  priority: 'CATCH_ERROR',
  onError(error) {
    // log, transform, or suppress errors
    console.error('WS handler error:', error)
  },
})

@Controller('chat')
@Intercept(wsErrorHandler)
export class ChatController {
  // ...
}
```

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

See the [client documentation](./client#error-handling) for more details.
