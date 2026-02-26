# Wire protocol — @moostjs/event-ws

> JSON message format, message types, error codes, heartbeat, and custom serialization.

## Concepts

Moost WS uses a simple JSON-over-WebSocket protocol. Messages are plain JSON objects sent as text frames. There are three message types:

1. **Client → Server** (`WsClientMessage`) — routed by event + path
2. **Server → Client: Reply** (`WsReplyMessage`) — response to an RPC call
3. **Server → Client: Push** (`WsPushMessage`) — server-initiated message

## Message Types

### WsClientMessage (Client → Server)

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

### WsReplyMessage (Server → Client)

Sent in response to a client message that included an `id`. Exactly one reply per request.

```ts
interface WsReplyMessage {
  id: string | number                          // Matches client's correlation ID
  data?: unknown                                // Handler return value
  error?: { code: number; message: string }     // Error details (if handler threw)
}
```

**Success:**
```json
{ "id": 1, "data": { "joined": true, "room": "general" } }
```

**Error:**
```json
{ "id": 1, "error": { "code": 400, "message": "Name is required" } }
```

### WsPushMessage (Server → Client)

Server-initiated messages from broadcasts, subscriptions, or direct sends.

```ts
interface WsPushMessage {
  event: string                        // Event type
  path: string                         // Concrete path
  params?: Record<string, string>      // Route params extracted by router
  data?: unknown                       // Payload
}
```

```json
{ "event": "message", "path": "/chat/general", "data": { "from": "Alice", "text": "Hello!" } }
```

## Error Codes

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

### WsError

Throw `WsError` for structured error responses:

```ts
import { WsError } from '@moostjs/event-ws'

throw new WsError(400, 'Name is required')
throw new WsError(401, 'Unauthorized')
```

```ts
class WsError extends Error {
  readonly code: number
  constructor(code: number, message?: string)
}
```

`WsError` works in:
- `@Message` handlers — sends error reply to client (if RPC)
- `@Upgrade` handlers — rejects the WebSocket connection
- `@Connect` handlers — closes the connection

Unhandled (non-`WsError`) exceptions send a generic `{ code: 500, message: "Internal Error" }` without leaking details.

## Heartbeat

The server sends periodic WebSocket `ping` frames to detect stale connections. Configure via `TWooksWsOptions`:

```ts
const ws = new MoostWs({
  wooksWs: {
    heartbeatInterval: 30000, // ms (default: 30000)
    heartbeatTimeout: 5000,   // ms (default: 5000)
  },
})
```

Set `heartbeatInterval: 0` to disable.

## Custom Serialization

Both server and client support pluggable serialization (e.g. MessagePack, CBOR):

```ts
const ws = new MoostWs({
  wooksWs: {
    messageParser: (raw: string) => myCustomParse(raw),
    messageSerializer: (msg: unknown) => myCustomSerialize(msg),
  },
})
```

Both sides must use the same serialization format.

## Client Library

Use `@wooksjs/ws-client` for a type-safe client:

```bash
npm install @wooksjs/ws-client
```

```ts
import { createWsClient } from '@wooksjs/ws-client'

const client = createWsClient('ws://localhost:3000/ws', {
  reconnect: true,
  rpcTimeout: 5000,
})

// RPC
const result = await client.call('join', '/chat/general', { name: 'Alice' })

// Listen for pushes
client.on('message', '/chat/general', ({ data }) => {
  console.log(`${data.from}: ${data.text}`)
})

// Fire-and-forget
client.send('message', '/chat/general', { from: 'Alice', text: 'Hello!' })
```

## Best Practices

- Use `id` (RPC) when the client needs a response, omit for fire-and-forget
- Use HTTP-style numeric codes for errors (400, 401, 404, etc.)
- Keep payloads small — default `maxMessageSize` is 1MB

## Gotchas

- Fire-and-forget messages that hit unmatched routes are logged but no error is sent to the client
- Oversized messages (exceeding `maxMessageSize`) are silently dropped
- Reply is only sent when client message includes `id` — handler return values are discarded otherwise
