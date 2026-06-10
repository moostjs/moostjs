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

Dependencies: `@wooksjs/event-ws` is a direct dependency of `@moostjs/event-ws`; peers `moost`, `@wooksjs/event-core`, `@prostojs/infact` come with `moost`. `ws` is a peer of `@wooksjs/event-ws` — add it explicitly (`pnpm add ws`) if your package manager doesn't auto-install peers.

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

Options type: `TMoostWsOpts` (+ optional `httpApp`).

```ts
new MoostWs()                                                    // standalone
new MoostWs({ wooksWs: options | existingWooksWs })              // with config or instance
new MoostWs({ httpApp: http.getHttpApp() })                      // HTTP-integrated
new MoostWs({ httpApp: http.getHttpApp(), wooksWs: { ... } })
```

`httpApp` accepts a `WooksHttp` instance OR any object with `getHttpApp()` returning one.

### TWooksWsOptions

Type importable from `@moostjs/event-ws`. Pass via `new MoostWs({ wooksWs: { ... } })` or `new WsApp().useWsOptions({ ws: { ... } })`.

| Key | Default | Effect |
|---|---|---|
| `heartbeatInterval` | 30000 ms | ping cadence; `0` disables. Standalone `listen()` only — inert in HTTP-integrated mode |
| `heartbeatTimeout` | — | declared in the type but a **no-op** in 0.7.x; effective pong deadline = `heartbeatInterval` (closed at next tick) |
| `messageParser` | `JSON.parse` | `(raw) => WsClientMessage` — custom decode (e.g. MessagePack) |
| `messageSerializer` | `JSON.stringify` | `(msg) => string \| Buffer` — custom encode for replies/pushes |
| `maxMessageSize` | 1 MB | oversized inbound messages dropped silently |
| `broadcastTransport` | — | cross-instance pub/sub — see [ws-rooms.md](ws-rooms.md) |
| `wsServerAdapter` | wraps `ws` | factory for a custom WS engine in noServer mode |
| `logger` | console | `TConsoleBase` |

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

### Re-exports

For convenience `@moostjs/event-ws` re-exports from `moost`: `Param`, `Controller`, `Intercept`, `Description`, `defineBeforeInterceptor`, `defineAfterInterceptor`, `defineInterceptor` (see [interceptors.md](interceptors.md)). It also re-exports the `EventKind` descriptors `wsConnectionKind` / `wsMessageKind` — use them in custom composables, e.g. `ctx.get(wsConnectionKind.keys.id)` or `ctx.get(wsMessageKind.keys.data)`.

## Wire protocol

JSON text frames. Types importable from `@moostjs/event-ws`:

| Type | Fields | Rule |
|---|---|---|
| `WsClientMessage` (client → server) | `event`, `path`, `data?`, `id?` | `id` present ⇒ RPC, server replies; absent ⇒ fire-and-forget, never any reply |
| `WsReplyMessage` (server → client) | `id`, then `data?` or `error?: { code, message }` | exactly one per RPC request; `error` set when handler threw |
| `WsPushMessage` (server → client) | `event`, `path`, `params?`, `data?` | server-initiated (broadcast / `send`); no `id` |

### RPC vs fire-and-forget

- Message without `id` → handler runs, no reply (even on return).
- Message with `id` → reply sent; handler throw → reply has `error` field.

### WsError + error codes

```ts
throw new WsError(403, 'Forbidden')
```
RPC messages get an `error` reply (uncaught non-`WsError` → 500 "Internal Error"; unmatched route → 404). Fire-and-forget: never any reply — thrown `WsError` is silently dropped (non-`WsError` is logged server-side). Throwing in `@Connect` closes the socket: close code 1008 for `WsError(401/403)`, else 1011, message = close reason. Throwing in `@Upgrade` destroys the socket with no HTTP response — code/message stay server-side.

Codes follow HTTP: 400, 401, 403, 404, 409, 429, 500, 503.

## Heartbeat & serialization

Heartbeat (ping/pong) runs **only in standalone mode** (`listen()`); HTTP-integrated mode starts no ping timer. A connection that misses a pong is closed at the next tick, so the effective timeout equals `heartbeatInterval`.

```ts
new MoostWs({ wooksWs: { heartbeatInterval: 30_000 } })  // default
new MoostWs({ wooksWs: { heartbeatInterval: 0 } })       // disable
```

Custom serializer (e.g. MessagePack):

```ts
new MoostWs({ wooksWs: {
  messageParser:     (raw) => decode(raw as Buffer) as WsClientMessage,
  messageSerializer: (msg) => Buffer.from(encode(msg)),
}})
```

## Client library

`@wooksjs/ws-client` — browser/Node client with reconnect + RPC. Uses the global `WebSocket` (built into browsers and Node >= 22); only Node < 22 needs the `ws` polyfill.

```ts
const client = createWsClient('ws://localhost:3000/ws', {
  reconnect: true, rpcTimeout: 10_000,
})

client.send('message', '/chat/rooms/lobby', { text: 'hi' })    // queued if reconnecting
const r = await client.call<{ id: string }>('rpc', '/users/123')

// push listener — client-side registration only, supports :params and * patterns
const off = client.on('message', '/chat/rooms/:roomId', ({ data, params }) => {})
// server-side subscription: sends RPC call('subscribe', path, data) —
// pair with a @Message('subscribe', ...) handler that joins the room.
// Auto-resubscribes on reconnect. Returns Promise<() => void>.
const unsub = await client.subscribe('/chat/rooms/lobby')

client.onOpen(()=>{}); client.onClose(()=>{}); client.onError(()=>{}); client.onReconnect(()=>{})
```

## Gotchas

- Return values sent only when client message has `id` (RPC).
- `@MessageData`, `@RawMessage`, `@MessageId`, `@MessageType`, `@MessagePath` throw if used outside `@Message`.
- `@Message()` without `path` uses **method name**.
- `Param` is re-exported by `@moostjs/event-ws`; `Params` must be imported from `moost`.
- Route params are strings — coerce via pipes.
- `useWsRooms()` only in message context (not `@Connect`/`@Disconnect`).
- `ws` is a peer dep of `@wooksjs/event-ws` — install it.
- Only ONE `@Connect` and one `@Disconnect` handler per app — a second registration silently replaces the first.
- Heartbeat runs only in standalone `listen()` mode (default 30s; 0 disables) — no pings in HTTP-integrated mode.
- Unmatched messages: fire-and-forget dropped silently (no log); RPC gets a 404 error reply.
- In HTTP-integrated mode, connection context parent = HTTP context.
