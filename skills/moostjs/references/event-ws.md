# WebSocket Adapter — @moostjs/event-ws

Moost adapter for decorator-based WebSocket servers, wrapping @wooksjs/event-ws.

For rooms and broadcasting, see [ws-rooms.md]. For testing, see [ws-testing.md].

## Table of contents

- [Setup](#setup)
- [Handlers](#handlers)
- [Routing](#routing)
- [Request Data](#request-data)
- [Wire Protocol](#wire-protocol)
- [Best Practices](#best-practices)
- [Gotchas](#gotchas)

## Setup

### Scaffold a project

```bash
# Standalone WebSocket server
npm create moost@latest -- --ws

# HTTP + WebSocket combined
npm create moost@latest -- --http
# then add @moostjs/event-ws
```

### Installation

```bash
npm install @moostjs/event-ws moost
# or
pnpm add @moostjs/event-ws moost
```

Peer dependencies (installed automatically with moost):
- `@wooksjs/event-core` — async event context
- `@prostojs/infact` — dependency injection
- `@wooksjs/event-ws` — underlying WebSocket engine
- `ws` — WebSocket server implementation (peer dep of @wooksjs/event-ws)

### Standalone mode — WsApp

`WsApp` extends `Moost` for quick standalone WebSocket servers without HTTP.

```ts
import { WsApp, Message, MessageData } from '@moostjs/event-ws'
import { Controller, Param } from 'moost'

@Controller('chat')
class ChatController {
  @Message('message', 'rooms/:roomId')
  onMessage(@Param('roomId') roomId: string, @MessageData() data: unknown) {
    return { received: true, roomId }
  }
}

const app = new WsApp()
app.controllers(ChatController)
await app.start(3000)
```

#### WsApp API

| Method | Returns | Description |
|--------|---------|-------------|
| `controllers(...ctrls)` | `this` | Register one or more controller classes (shortcut for `registerControllers`) |
| `useWsOptions(opts)` | `this` | Configure WS options before starting |
| `start(port, hostname?)` | `Promise<void>` | Create adapter, init Moost, start listening |
| `getWsAdapter()` | `MoostWs \| undefined` | Access the underlying MoostWs adapter instance |

### HTTP-integrated mode — MoostWs + MoostHttp

Attach both adapters to share the HTTP server. Register an upgrade controller to handle the WebSocket handshake.

```ts
import { MoostHttp, Upgrade } from '@moostjs/event-http'
import { MoostWs, Message, MessageData } from '@moostjs/event-ws'
import { Moost, Controller, Param, Injectable, Inject } from 'moost'
import { WooksWs } from '@wooksjs/event-ws'

@Controller()
class AppController {
  constructor(@Inject('WooksWs') private ws: WooksWs) {}

  @Upgrade('/ws')
  handleUpgrade() {
    return this.ws.upgrade()
  }
}

@Controller('chat')
class ChatController {
  @Message('message', 'rooms/:roomId')
  onMessage(@Param('roomId') roomId: string, @MessageData() data: unknown) {
    return { received: true, roomId }
  }
}

const app = new Moost()
const http = new MoostHttp()
const ws = new MoostWs({ httpApp: http })

app.adapter(http).listen(3000)
app.adapter(ws)
app.registerControllers(AppController, ChatController)
await app.init()
```

### MoostWs constructor

```ts
import { MoostWs } from '@moostjs/event-ws'

// Standalone — no HTTP integration
const ws = new MoostWs()

// With WooksWs options
const ws = new MoostWs({ wooksWs: { heartbeatInterval: 30_000 } })

// With an existing WooksWs instance
const ws = new MoostWs({ wooksWs: existingWooksWs })

// HTTP-integrated — pass the MoostHttp adapter
const ws = new MoostWs({ httpApp: http })

// HTTP-integrated with WS options
const ws = new MoostWs({ httpApp: http, wooksWs: { maxMessageSize: 2 * 1024 * 1024 } })
```

### MoostWs methods

| Method | Returns | Description |
|--------|---------|-------------|
| `listen(port, hostname?)` | `Promise<void>` | Start a standalone WS server (without HTTP integration) |
| `close()` | `void` | Stop the server, close all connections, clean up heartbeat |
| `getWsApp()` | `WooksWs` | Access the underlying Wooks WS engine |

### TWooksWsOptions

Options passed to the underlying `@wooksjs/event-ws` engine.

```ts
interface TWooksWsOptions {
  heartbeatInterval?: number   // ping interval in ms (default: 30000, 0 = disabled)
  heartbeatTimeout?: number    // pong timeout in ms (default: 5000)
  messageParser?: (raw: Buffer | string) => WsClientMessage
  messageSerializer?: (msg: WsReplyMessage | WsPushMessage) => string | Buffer
  maxMessageSize?: number      // bytes (default: 1MB), oversized messages dropped
  broadcastTransport?: WsBroadcastTransport  // for multi-instance broadcasting
  wsServerAdapter?: WsServerAdapter          // custom WS engine (default: wraps `ws`)
  logger?: TConsoleBase
}
```

### DI-available services

When MoostWs is attached, these are available via constructor injection:

| Token | Type | Description |
|-------|------|-------------|
| `MoostWs` | class | The MoostWs adapter instance |
| `'MoostWs'` | string | Same, by string token |
| `WooksWs` | class | The underlying Wooks WS engine |
| `'WooksWs'` | string | Same, by string token |

```ts
import { Injectable, Inject } from 'moost'
import { WooksWs } from '@wooksjs/event-ws'

@Injectable()
class MyService {
  constructor(@Inject('WooksWs') private ws: WooksWs) {}
}
```

## Handlers

### Handler decorators

All imported from `@moostjs/event-ws`:

| Decorator | Context | Description |
|-----------|---------|-------------|
| `@Message(event, path?)` | Message | Register a handler for routed WebSocket messages |
| `@Connect()` | Connection | Register a handler for new connections |
| `@Disconnect()` | Connection | Register a handler for connection close |

### @Message(event, path?)

Route WebSocket messages by event type and path. The `event` and `path` match fields from the `WsClientMessage` wire protocol.

```ts
import { Message, MessageData } from '@moostjs/event-ws'
import { Controller, Param } from 'moost'

@Controller('chat')
class ChatController {
  @Message('message', 'rooms/:roomId')
  onMessage(@Param('roomId') roomId: string, @MessageData() data: unknown) {
    return { received: true, roomId }
  }

  @Message('rpc', 'users/:id')
  getUser(@Param('id') id: string) {
    return { id, name: 'Alice' }
  }
}
```

### @Connect() and @Disconnect()

Handle connection lifecycle events. Throwing in `@Connect()` closes the connection immediately.

```ts
import { Connect, Disconnect, ConnectionId } from '@moostjs/event-ws'
import { Controller } from 'moost'

@Controller()
class ConnectionController {
  @Connect()
  onConnect(@ConnectionId() id: string) {
    console.log('Connected:', id)
  }

  @Disconnect()
  onDisconnect(@ConnectionId() id: string) {
    console.log('Disconnected:', id)
  }
}
```

### Return values

Handler return values are sent as replies **only when** the client message included a correlation `id` (RPC pattern). Fire-and-forget messages (no `id`) produce no reply even if the handler returns a value.

### Pattern: mixed HTTP and WS handlers in one controller

```ts
import { Get } from '@moostjs/event-http'
import { Message } from '@moostjs/event-ws'
import { Controller, Param } from 'moost'

@Controller('users')
class UserController {
  @Get(':id')
  getUser(@Param('id') id: string) { return { id, name: 'Alice' } }

  @Message('rpc', ':id')
  getUserWs(@Param('id') id: string) { return { id, name: 'Alice' } }
}
```

### Pattern: full lifecycle controller with rooms

```ts
import { Message, Connect, Disconnect, MessageData, ConnectionId } from '@moostjs/event-ws'
import { Controller, Intercept, Param } from 'moost'
import { useWsRooms } from '@moostjs/event-ws'

@Controller('chat')
@Intercept(authInterceptor)
class ChatController {
  @Connect()
  onConnect(@ConnectionId() id: string) { console.log('Connected:', id) }

  @Message('subscribe', 'rooms/:roomId')
  onSubscribe() { useWsRooms().join(); return { ok: true } }

  @Message('message', 'rooms/:roomId')
  onMessage(@MessageData() data: unknown) { useWsRooms().broadcast('message', data) }

  @Disconnect()
  onDisconnect(@ConnectionId() id: string) { console.log('Disconnected:', id) }
}
```

## Routing

### Event + path two-dimensional routing

WebSocket messages are routed by two dimensions: the `event` field (first argument to `@Message`) and the `path` field. Both must match for a handler to fire.

```ts
@Message('message', 'chat/lobby')   // event="message", path prefix + "chat/lobby"
@Message('rpc', 'chat/lobby')       // event="rpc",     same path, different event
```

### Controller prefixes and nesting

`@Controller(prefix)` prepends the prefix to all handler paths. Use `@ImportController` to nest controllers.

```ts
@Controller('api')
@ImportController(() => ChatController)
class ApiController {
  // routes: /api/chat/...
}

@Controller('chat')
class ChatController {
  @Message('message', 'rooms/:roomId')
  onMessage() {} // resolves to: event="message", path="/api/chat/rooms/:roomId"
}
```

### Parametric routes, wildcards, path omission

```ts
@Message('rpc', 'users/:id')
getUser(@Param('id') id: string) {}

@Message('message', '*')
catchAll(@Param('*') path: string) {}

// Path omission — method name becomes the path
@Message('rpc')
status() {} // path="/controllerPrefix/status"
```

## Request Data

### Message decorators (only in @Message handlers)

| Decorator | Returns | Description |
|-----------|---------|-------------|
| `@MessageData()` | `unknown` | Parsed message payload (`data` field) |
| `@RawMessage()` | `Buffer \| string` | Raw message before parsing |
| `@MessageId()` | `string \| number \| undefined` | Correlation ID (`id` field) |
| `@MessageType()` | `string` | Event type string (`event` field) |
| `@MessagePath()` | `string` | Concrete message path (`path` field) |

### Connection decorators (all WS handlers)

| Decorator | Returns | Description |
|-----------|---------|-------------|
| `@ConnectionId()` | `string` | Connection UUID |

### Route parameters

Imported from `moost`, not from `@moostjs/event-ws`:

```ts
import { Param, Params } from 'moost'

@Message('rpc', 'users/:id')
getUser(@Param('id') id: string) {}

@Message('rpc', 'users/:type/:id')
getUser(@Params() params: { type: string, id: string }) {}
```

### Using Wooks composables directly

For advanced use, access the underlying composables (re-exported from `@moostjs/event-ws`):

- `useWsMessage<T>()` — returns `{ data: T, raw, id, path, event }`. Only in `@Message` handlers.
- `useWsConnection()` — returns `{ id, send(event, path, data?, params?), close(code?, reason?), context }`. All WS handlers.

```ts
import { useWsMessage, useWsConnection } from '@moostjs/event-ws'

@Message('message', 'chat/:room')
onMessage() {
  const { data, id } = useWsMessage<{ text: string }>()
  const { send } = useWsConnection()
  send('ack', '/chat/lobby', { received: true })
}
```

### HTTP context in WS handlers (HTTP-integrated mode)

When using HTTP-integrated mode, the HTTP context becomes the parent of the WS connection context. Composables from `@wooksjs/event-http` can read HTTP headers, cookies, and authorization data via the parent chain.

### Summary table

| Decorator | Handler types | Import from |
|-----------|--------------|-------------|
| `@MessageData()` | `@Message` | `@moostjs/event-ws` |
| `@RawMessage()` | `@Message` | `@moostjs/event-ws` |
| `@MessageId()` | `@Message` | `@moostjs/event-ws` |
| `@MessageType()` | `@Message` | `@moostjs/event-ws` |
| `@MessagePath()` | `@Message` | `@moostjs/event-ws` |
| `@ConnectionId()` | `@Message`, `@Connect`, `@Disconnect` | `@moostjs/event-ws` |
| `@Param(name)` | `@Message` | `moost` |
| `@Params()` | `@Message` | `moost` |

## Wire Protocol

### Message types

Three message types define the wire protocol between client and server.

**Client to Server (`WsClientMessage`):**

```ts
interface WsClientMessage {
  event: string          // router method (e.g. 'message', 'rpc', 'subscribe')
  path: string           // route path (e.g. '/chat/rooms/lobby')
  data?: unknown         // payload
  id?: string | number   // correlation ID — triggers a reply
}
```

**Server to Client reply (`WsReplyMessage`):**

```ts
interface WsReplyMessage {
  id: string | number    // matches the client's id
  data?: unknown         // handler return value
  error?: { code: number, message: string }
}
```

**Server to Client push (`WsPushMessage`):**

```ts
interface WsPushMessage {
  event: string
  path: string
  params?: Record<string, string>
  data?: unknown
}
```

### Fire-and-forget vs RPC

- **Fire-and-forget**: Client sends a message without `id`. The server handler runs but no reply is sent, even if the handler returns a value.
- **RPC**: Client sends a message with `id`. The server sends a `WsReplyMessage` with the same `id` and the handler return value as `data`. If the handler throws, the reply contains an `error` object.

### Error codes

Errors follow HTTP status code conventions:

| Code | Meaning |
|------|---------|
| 400 | Bad Request — malformed message |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found — no matching route |
| 409 | Conflict |
| 429 | Too Many Requests |
| 500 | Internal Server Error |
| 503 | Service Unavailable |

### WsError

Throw `WsError` in any handler to send a structured error reply to the client.

```ts
import { WsError } from '@moostjs/event-ws'

@Message('rpc', 'admin/stats')
getStats() {
  if (!isAdmin) {
    throw new WsError(403, 'Forbidden')
  }
  return { connections: 42 }
}
```

`WsError` works in `@Message`, `@Connect`, and `@Disconnect` handlers. In `@Connect`, throwing closes the connection. In `@Message` with RPC, the error is sent as a reply. Uncaught exceptions become code 500 errors.

### Heartbeat

Heartbeat keeps connections alive via WebSocket ping/pong frames. Enabled by default.

```ts
const ws = new MoostWs({
  wooksWs: {
    heartbeatInterval: 30_000,  // ping every 30s (default)
    heartbeatTimeout: 5_000,    // close if no pong within 5s (default)
  },
})

// Disable heartbeat
const ws = new MoostWs({
  wooksWs: { heartbeatInterval: 0 },
})
```

### Custom serialization

Override the default JSON serialization for custom wire formats (e.g., MessagePack, CBOR).

```ts
import { encode, decode } from '@msgpack/msgpack'

const ws = new MoostWs({
  wooksWs: {
    messageParser: (raw) => decode(raw as Buffer) as WsClientMessage,
    messageSerializer: (msg) => Buffer.from(encode(msg)),
  },
})
```

### Client library

Use `@wooksjs/ws-client` (`pnpm add @wooksjs/ws-client`) to connect from browser or Node.js.

```ts
import { createWsClient } from '@wooksjs/ws-client'

const client = createWsClient('ws://localhost:3000/ws', {
  reconnect: true,          // auto-reconnect on disconnect
  rpcTimeout: 10_000,       // RPC call timeout in ms (default: 10000)
  // _WebSocket: WebSocket, // pass WebSocket impl for Node.js (e.g. from 'ws')
})

// Fire-and-forget (queued when disconnected with reconnect enabled)
client.send('message', '/chat/rooms/lobby', { text: 'hello' })

// RPC — returns handler result, rejects on error or timeout
const result = await client.call<{ id: string }>('rpc', '/users/123')

// Listen for server pushes (not auto-resubscribed on reconnect)
const off = client.on('notification', '/alerts', (msg) => {
  // msg: WsPushMessage { event, path, params?, data? }
  console.log(msg.data)
})

// Subscribe with auto-resubscribe on reconnect
const unsub = client.subscribe('subscribe', '/chat/rooms/lobby', (msg) => {
  console.log(msg.data)
})

// Lifecycle hooks
client.onOpen(() => console.log('connected'))
client.onClose(() => console.log('disconnected'))
client.onError((err) => console.error(err))
client.onReconnect(() => console.log('reconnected'))

// Connection management
await client.connect()
client.disconnect()
```

## Best practices

- Use HTTP-integrated mode for production — share the HTTP server and handle UPGRADE routing cleanly
- Prefer the decorator-based API (`@MessageData`, `@ConnectionId`, etc.) over accessing Wooks composables directly
- Use `registerControllers()` to add controller classes, not instances
- Call `app.adapter(ws)` before `app.init()` — the adapter must be attached before initialization
- Set `maxMessageSize` appropriate for your use case to prevent memory abuse
- Use `WsError` with HTTP-style codes for structured error replies
- Keep `@Connect()` handlers fast — they block connection acceptance
- Use `@Message('rpc', path)` for request-response patterns and `@Message('message', path)` for fire-and-forget
- Use `@Controller` prefixes to namespace related WS handlers: `@Controller('chat')`, `@Controller('game')`

## Gotchas

- Handler return values are only sent as replies when the client message included an `id` field — fire-and-forget messages get no reply even if the handler returns a value
- `@MessageData()`, `@RawMessage()`, `@MessageId()`, `@MessageType()`, `@MessagePath()` are only available in `@Message` handlers — using them in `@Connect` or `@Disconnect` throws
- `@Message()` without a `path` argument uses the **method name** as the path — this is rarely what you want
- `@Param` and `@Params` are imported from `moost`, not from `@moostjs/event-ws`
- Route parameters are always strings — use pipes to transform to numbers/booleans
- `app.init()` must be called after `registerControllers()` — routes are bound during initialization
- The `ws` package is a peer dependency of `@wooksjs/event-ws` — install it explicitly
- `useWsRooms()` is only available in message context (inside `@Message` handlers), not in `@Connect`/`@Disconnect`
- When a connection context has an HTTP parent (integrated mode), composables from `@wooksjs/event-http` can read HTTP headers/cookies via the parent chain
- Heartbeat is enabled by default (30s); set to 0 only for short-lived connections
