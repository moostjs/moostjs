# WebSocket Adapter — @moostjs/event-ws

Moost adapter over `@wooksjs/event-ws`. Rooms/broadcasting: [ws-rooms.md](ws-rooms.md). Testing: [ws-testing.md](ws-testing.md).

- [Setup](#setup)
- [MoostWs / WsApp](#moostws--wsapp)
- [Handlers](#handlers)
- [Routing](#routing)
- [Request data](#request-data)
- [Wire protocol](#wire-protocol)
- [Heartbeat & serialization](#heartbeat--serialization)
- [Client library](#client-library)
- [Gotchas](#gotchas)

## Setup

```bash
npm create moost@latest [name] -- --ws    # standalone
# or: --http then add @moostjs/event-ws
pnpm add @moostjs/event-ws moost
```

Peer deps (auto-installed with moost): `@wooksjs/event-core`, `@prostojs/infact`, `@wooksjs/event-ws`, `ws`.

### Standalone — WsApp

```ts
import { WsApp, Message, MessageData } from '@moostjs/event-ws'
import { Controller, Param } from 'moost'

@Controller('chat')
class ChatController {
  @Message('message', 'rooms/:roomId')
  onMessage(@Param('roomId') id: string, @MessageData() data: unknown) {
    return { received: true, roomId: id }
  }
}

await new WsApp().controllers(ChatController).start(3000)
```

WsApp methods: `.controllers(...)`, `.useWsOptions(opts)`, `.start(port, hostname?)`, `.getWsAdapter()`.

### HTTP-integrated — MoostWs + MoostHttp

Share the HTTP server; register an upgrade handler.

```ts
@Controller()
class AppController {
  constructor(@Inject('WooksWs') private ws: WooksWs) {}
  @Upgrade('/ws')
  handleUpgrade() { return this.ws.upgrade() }
}

const app = new Moost()
const http = new MoostHttp()
const ws = new MoostWs({ httpApp: http.getHttpApp() })
app.adapter(http).listen(3000)
app.adapter(ws)
app.registerControllers(AppController, ChatController)
await app.init()
```

## MoostWs / WsApp

### MoostWs constructor

```ts
new MoostWs()                                                    // standalone
new MoostWs({ wooksWs: options | existingWooksWs })              // with config or instance
new MoostWs({ httpApp: http.getHttpApp() })                      // HTTP-integrated
new MoostWs({ httpApp: http.getHttpApp(), wooksWs: { ... } })
```

`httpApp` accepts a `WooksHttp` instance OR any object with `getHttpApp()` returning one.

### TWooksWsOptions

```ts
interface TWooksWsOptions {
  heartbeatInterval?: number   // ms, default 30000 (0 disables)
  heartbeatTimeout?:  number   // ms, default 5000
  messageParser?:     (raw: Buffer|string) => WsClientMessage
  messageSerializer?: (msg: WsReplyMessage|WsPushMessage) => string|Buffer
  maxMessageSize?:    number   // bytes, default 1MB — oversized dropped
  broadcastTransport?: WsBroadcastTransport  // see ws-rooms.md
  wsServerAdapter?:   WsServerAdapter        // custom WS engine (defaults to `ws`)
  logger?:            TConsoleBase
}
```

### MoostWs methods

| Method | Returns | Notes |
|---|---|---|
| `listen(port, hostname?)` | `Promise<void>` | standalone server |
| `close()` | `void` | closes connections, heartbeat |
| `getWsApp()` | `WooksWs` | underlying engine |

### DI-exposed services

| Token | Type |
|---|---|
| `MoostWs`, `'MoostWs'` | adapter |
| `WooksWs`, `'WooksWs'` | underlying engine |

## Handlers

| Decorator | Context | Notes |
|---|---|---|
| `@Message(event, path?)` | message | routed by `event` + `path` |
| `@Connect()` | connection | throwing closes the connection |
| `@Disconnect()` | connection | on close |

Return values are sent as replies **only if** the client message included a correlation `id`. Fire-and-forget (no `id`) produces no reply.

```ts
@Controller('chat')
@Intercept(authInterceptor)
class ChatController {
  @Connect()    onConnect(@ConnectionId() id: string) {}
  @Message('subscribe', 'rooms/:roomId') sub() { useWsRooms().join(); return { ok: true } }
  @Message('message',   'rooms/:roomId') onMsg(@MessageData() d: unknown) { useWsRooms().broadcast('message', d) }
  @Disconnect() onDisconnect(@ConnectionId() id: string) {}
}
```

Mixed HTTP/WS in one controller:

```ts
@Controller('users')
class UserController {
  @Get(':id')             getUser(@Param('id') id: string)   {}
  @Message('rpc', ':id')  getUserWs(@Param('id') id: string) {}
}
```

## Routing

Two-dimensional: `event` (first arg of `@Message`) + `path`. Both must match. `@Controller(prefix)` prepends; `@ImportController` nests paths.

```ts
@Message('message', 'chat/lobby')     // event=message, path=/chat/lobby
@Message('rpc',     'chat/lobby')     // same path, different event
@Message('rpc',     'users/:id')      // parametric
@Message('message', '*')              // wildcard
@Message('rpc')                       // path defaults to method name
```

## Request data

### Message decorators (only in `@Message` handlers)

| Decorator | Returns |
|---|---|
| `@MessageData()` | parsed `data` |
| `@RawMessage()` | `Buffer \| string` |
| `@MessageId()` | `string \| number \| undefined` (correlation id) |
| `@MessageType()` | `event` field |
| `@MessagePath()` | concrete path |

### Connection decorator (all WS handlers)

| Decorator | Returns |
|---|---|
| `@ConnectionId()` | UUID |

### Route params — from `moost`

```ts
@Message('rpc', 'users/:id')        getUser(@Param('id') id: string)
@Message('rpc', 'users/:type/:id')  getUser(@Params() p: { type: string; id: string })
```

### Direct composables (re-exported by `@moostjs/event-ws`)

- `useWsMessage<T>()` — `{ data, raw, id, path, event }`. `@Message` only.
- `useWsConnection()` — `{ id, send(event, path, data?, params?), close(code?, reason?), context }`. All handlers.

HTTP-integrated mode: WS connection context has HTTP context as parent. `@wooksjs/event-http` composables can read HTTP headers/cookies via the parent chain.

## Wire protocol

```ts
interface WsClientMessage {
  event: string          // 'message', 'rpc', 'subscribe', …
  path: string           // '/chat/rooms/lobby'
  data?: unknown
  id?: string | number   // present = RPC (expect reply)
}
interface WsReplyMessage {
  id: string | number
  data?: unknown
  error?: { code: number; message: string }
}
interface WsPushMessage {
  event: string; path: string
  params?: Record<string, string>
  data?: unknown
}
```

### RPC vs fire-and-forget

- Message without `id` → handler runs, no reply (even on return).
- Message with `id` → reply sent; handler throw → reply has `error` field.

### WsError + error codes

```ts
throw new WsError(403, 'Forbidden')
```
Works in `@Message`, `@Connect` (closes connection), `@Disconnect`. Uncaught → code 500.

Codes follow HTTP: 400, 401, 403, 404, 409, 429, 500, 503.

## Heartbeat & serialization

```ts
new MoostWs({ wooksWs: {
  heartbeatInterval: 30_000,   // default
  heartbeatTimeout:  5_000,    // default
}})
new MoostWs({ wooksWs: { heartbeatInterval: 0 } })  // disable
```

Custom serializer (e.g. MessagePack):

```ts
new MoostWs({ wooksWs: {
  messageParser:     (raw) => decode(raw as Buffer) as WsClientMessage,
  messageSerializer: (msg) => Buffer.from(encode(msg)),
}})
```

## Client library

`@wooksjs/ws-client` — browser/Node client with reconnect + RPC.

```ts
const client = createWsClient('ws://localhost:3000/ws', {
  reconnect: true, rpcTimeout: 10_000,
  // _WebSocket: WebSocket,  // for Node, pass ws WebSocket
})

client.send('message', '/chat/rooms/lobby', { text: 'hi' })    // queued if reconnecting
const r = await client.call<{ id: string }>('rpc', '/users/123')

const off = client.on('notification', '/alerts', (msg) => {})           // not auto-resub
const unsub = client.subscribe('subscribe', '/chat/rooms/lobby', (m) => {}) // auto-resub on reconnect

client.onOpen(()=>{}); client.onClose(()=>{}); client.onError(()=>{}); client.onReconnect(()=>{})
```

## Gotchas

- Return values sent only when client message has `id` (RPC).
- `@MessageData`, `@RawMessage`, `@MessageId`, `@MessageType`, `@MessagePath` throw if used outside `@Message`.
- `@Message()` without `path` uses **method name**.
- `@Param`/`@Params` from `moost`, not `@moostjs/event-ws`.
- Route params are strings — coerce via pipes.
- `useWsRooms()` only in message context (not `@Connect`/`@Disconnect`).
- `ws` is a peer dep of `@wooksjs/event-ws` — install it.
- Heartbeat default 30s; set 0 only for short-lived connections.
- In HTTP-integrated mode, connection context parent = HTTP context.
