# Handlers — @moostjs/event-ws

> Defining WebSocket event handlers with @Message, @Connect, and @Disconnect decorators.

## Concepts

Moost WS provides three handler decorators:
- `@Message(event, path?)` — handles routed WebSocket messages
- `@Connect()` — runs when a new connection is established
- `@Disconnect()` — runs when a connection closes

All handlers participate in the full Moost event lifecycle (scope registration, interceptor init, argument resolution, handler execution, interceptor after/onError, scope cleanup).

## API Reference

### `@Message(event: string, path?: string)`

Registers a handler for routed WebSocket messages. Matches on both the `event` field and `path` from the client message.

```ts
import { Message, MessageData } from '@moostjs/event-ws'
import { Controller } from 'moost'

@Controller()
export class EchoController {
  @Message('echo', '/echo')
  echo(@MessageData() data: unknown) {
    return data // sent back as reply if client included an id
  }
}
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `event` | `string` | Message event type to match (e.g. `"message"`, `"join"`, `"rpc"`) |
| `path` | `string` (optional) | Route path with optional params. When omitted, the method name is used. |

**Return values:** The return value is sent as a reply only when the client included a correlation `id` (RPC). Fire-and-forget messages (no `id`) ignore the return value.

### `@Connect()`

Runs when a new WebSocket connection is established. Executes inside the connection context.

```ts
import { Connect, ConnectionId } from '@moostjs/event-ws'
import { Controller } from 'moost'

@Controller()
export class LifecycleController {
  @Connect()
  onConnect(@ConnectionId() id: string) {
    console.log(`New connection: ${id}`)
  }
}
```

If the handler throws or returns a rejected promise, the connection is closed immediately.

### `@Disconnect()`

Runs when a WebSocket connection closes. Use for cleanup.

```ts
import { Disconnect, ConnectionId } from '@moostjs/event-ws'
import { Controller } from 'moost'

@Controller()
export class LifecycleController {
  @Disconnect()
  onDisconnect(@ConnectionId() id: string) {
    console.log(`Connection ${id} closed`)
  }
}
```

Room membership is automatically cleaned up on disconnect — no need to manually leave rooms.

## Common Patterns

### Pattern: Multiple events on the same path

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

### Pattern: Mixed HTTP and WS handlers in one controller

A single controller can contain both HTTP and WebSocket handlers when both adapters are registered:

```ts
import { Get } from '@moostjs/event-http'
import { Message, MessageData } from '@moostjs/event-ws'
import { Controller } from 'moost'

@Controller('api')
export class ApiController {
  @Get('status')
  getStatus() { return { online: true } }

  @Message('query', '/status')
  wsStatus() { return { online: true } }
}
```

### Pattern: Protected handlers with interceptors

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

### Pattern: Full lifecycle controller

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

## Best Practices

- Keep `@Connect` handlers lightweight — they block the connection establishment
- Use `@Disconnect` for cleanup, but don't rely on it for room management (rooms auto-clean)
- One controller can have at most one `@Connect` and one `@Disconnect` handler
- Use interceptors (`@Intercept`) for cross-cutting concerns like auth and logging

## Gotchas

- Throwing in `@Connect` closes the connection immediately — use `WsError` for meaningful error codes
- Fire-and-forget messages (no `id`) silently discard handler return values
- `@Message` path is relative to the controller prefix, not absolute
