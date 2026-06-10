# Wire Protocol


Moost WS uses a simple JSON-over-WebSocket protocol. Messages are plain JSON objects sent as text frames — no custom framing, no binary encoding.

For the full Wooks protocol reference, see the [Wooks Wire Protocol Documentation](https://wooks.moost.org/wsapp/protocol.html).

[[toc]]

## Message Types

### Client to Server

Every client message has an `event` and `path` for routing, optional `data` for payload, and an optional `id` for RPC correlation:

```ts
interface WsClientMessage {
  event: string            // Router method (e.g. "message", "join", "query")
  path: string             // Route path (e.g. "/chat/general")
  data?: unknown           // Payload
  id?: string | number     // Correlation ID — present for RPC, absent for fire-and-forget
}
```

**Fire-and-forget** (no reply expected):
```json
{ "event": "message", "path": "/chat/general", "data": { "text": "Hello!" } }
```

**RPC** (reply expected):
```json
{ "event": "join", "path": "/chat/general", "data": { "name": "Alice" }, "id": 1 }
```

### Server to Client: Reply

Sent in response to a client message that included an `id`. Exactly one reply per request.

```ts
interface WsReplyMessage {
  id: string | number                             // Matches client's correlation ID
  data?: unknown                                   // Handler return value
  error?: { code: number; message: string }        // Error details (if handler threw)
}
```

**Success reply:**
```json
{ "id": 1, "data": { "joined": true, "room": "general" } }
```

**Error reply:**
```json
{ "id": 1, "error": { "code": 400, "message": "Name is required" } }
```

### Server to Client: Push

Server-initiated messages from broadcasts, subscriptions, or direct sends. No `id` field.

```ts
interface WsPushMessage {
  event: string                        // Event type
  path: string                         // Concrete path
  params?: Record<string, string>      // Route params extracted by router
  data?: unknown                       // Payload
}
```

**Push example:**
```json
{
  "event": "message",
  "path": "/chat/general",
  "data": { "from": "Alice", "text": "Hello!" }
}
```

## Routing Logic

Messages are routed by two dimensions:

1. **Event** — the `event` field acts as the "method" (like HTTP GET/POST)
2. **Path** — the `path` field acts as the URL path

The router matches against registered handlers:

```ts
// Server-side handler
@Message('join', '/chat/:room')
join(@Param('room') room: string) { /* ... */ }
```

```json
// Client message that matches
{ "event": "join", "path": "/chat/general", "data": { "name": "Alice" }, "id": 1 }
```

The `event` must match exactly. The `path` supports parametric patterns (`:param`) and wildcards (`*`).

## Error Responses

When a handler throws an error, the server replies with an error object (only for RPC messages with an `id`):

| Scenario | Code | Message |
|----------|------|---------|
| Handler throws `WsError(code, msg)` | Custom code | Custom message |
| No matching handler found | 404 | `"Not found"` |
| Unhandled exception in handler | 500 | `"Internal Error"` |

```json
{ "id": 1, "error": { "code": 404, "message": "Not found" } }
```

For fire-and-forget messages (no `id`), no error is ever sent to the client. Unexpected (non-`WsError`) exceptions are logged server-side, while thrown `WsError` instances are silently discarded — no reply, no log.

## Heartbeat

In standalone mode the server sends periodic WebSocket `ping` frames to detect stale connections. A connection that hasn't responded with a `pong` by the next heartbeat tick is disconnected — so the effective timeout equals the interval.

Configure the heartbeat interval:

```ts
const ws = new MoostWs({
  wooksWs: {
    heartbeatInterval: 30000, // milliseconds (default: 30000)
  },
})
await ws.listen(3000)
```

Set to `0` to disable heartbeat.

::: warning Standalone mode only
The heartbeat timer starts in `listen()` — it does not run in [HTTP-integrated mode](./integration) (`httpApp` option), where the `heartbeatInterval` option is currently inert and no ping frames are sent.
:::

## Custom Serialization

Both server and client support pluggable serialization for formats like MessagePack or CBOR:

**Server:**
```ts
const ws = new MoostWs({
  wooksWs: {
    messageParser: (raw: Buffer | string) => myCustomParse(raw),
    messageSerializer: (msg: WsReplyMessage | WsPushMessage) => myCustomSerialize(msg),
  },
})
```

**Client:**
```ts
const client = createWsClient('ws://localhost:3000/ws', {
  messageParser: (raw: string) => myCustomParse(raw),
  messageSerializer: (msg: unknown) => myCustomSerialize(msg),
})
```

Both sides must use the same serialization format.
