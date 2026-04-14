# WebSocket Rooms & Broadcasting — @moostjs/event-ws

Room-based connection grouping, local and cross-instance broadcasting, and the broadcast transport interface.

For core WS setup, see [event-ws.md].

## Concepts

Rooms are named groups of connections. A connection can join multiple rooms. Broadcasting sends a push message to all connections in a room, optionally excluding the sender.

The room system has two layers:

1. **Local** — `WsRoomManager` tracks `Map<string, Set<WsConnection>>` in memory
2. **Distributed** — optional `WsBroadcastTransport` for cross-instance pub/sub (e.g., Redis)

When a message is broadcast:

1. Local connections in the room receive it directly
2. If a transport is configured, the message is published to `ws:room:{roomName}` for other instances
3. Other instances receive it via the transport subscription and forward to their local connections

Three composables provide the rooms API:

| Composable | Scope | Purpose |
|------------|-------|---------|
| `useWsRooms()` | Message context | Room-scoped join/leave/broadcast for current connection |
| `useWsConnection()` | Any WS context | Direct send to current connection |
| `useWsServer()` | Any context | Server-wide broadcast and connection lookup |

## API Reference

### useWsRooms()

Room management scoped to the current connection. **Only available in message context** (inside `@Message` handlers). Defaults to the current message path as the room name.

```ts
import { useWsRooms } from '@moostjs/event-ws'
```

Returns:

```ts
{
  join(room?): void              // join a room (default: current message path)
  leave(room?): void             // leave a room (default: current message path)
  broadcast(event, data?, options?): void  // broadcast to a room
  rooms(): string[]              // list rooms this connection has joined
}
```

`WsBroadcastOptions`:

```ts
{
  room?: string          // target room (default: current message path)
  excludeSelf?: boolean  // exclude sender (default: true)
}
```

### useWsConnection()

Access the current WebSocket connection. Works in connection and message contexts.

```ts
import { useWsConnection } from '@moostjs/event-ws'
```

Returns:

```ts
{
  id: string                                    // unique connection ID (UUID)
  send(event, path, data?, params?): void       // push a message to this client
  close(code?, reason?): void                   // close the connection
  context: EventContext                         // the connection EventContext
}
```

### useWsServer()

Server-wide operations. Available in any context (not scoped to a specific connection). Reads from adapter state, not from `EventContext`.

```ts
import { useWsServer } from '@moostjs/event-ws'
```

Returns:

```ts
{
  connections(): Map<string, WsConnection>         // all active connections
  broadcast(event, path, data?, params?): void     // broadcast to ALL connections
  getConnection(id: string): WsConnection | undefined
  roomConnections(room: string): Set<WsConnection> // connections in a room
}
```

### currentConnection()

Return the connection `EventContext` regardless of whether you are in a connection or message handler.

```ts
import { currentConnection } from '@moostjs/event-ws'

const connCtx = currentConnection()
```

- In `@Connect`/`@Disconnect`: returns `current()` directly
- In `@Message`: returns `current().parent` (the connection context)

## Common Patterns

### Join room and broadcast

```ts
import { Message, MessageData } from '@moostjs/event-ws'
import { Controller, Param } from 'moost'
import { useWsRooms, useWsMessage } from '@moostjs/event-ws'

@Controller('chat')
class ChatController {
  @Message('subscribe', 'rooms/:roomId')
  onSubscribe(@Param('roomId') roomId: string) {
    const { join } = useWsRooms()
    join() // joins room = "/chat/rooms/:roomId" (resolved path)
    return { subscribed: true }
  }

  @Message('unsubscribe', 'rooms/:roomId')
  onUnsubscribe() {
    const { leave } = useWsRooms()
    leave()
    return { unsubscribed: true }
  }

  @Message('message', 'rooms/:roomId')
  onMessage(@MessageData() data: { text: string }) {
    const { broadcast } = useWsRooms()
    broadcast('message', data) // excludes sender by default
    return { sent: true }
  }
}
```

### Broadcast message to room

```ts
const { broadcast } = useWsRooms()

// Broadcast to current path's room, exclude sender
broadcast('message', { text: 'hello' })

// Broadcast to a specific room, include sender
broadcast('message', { text: 'hello' }, {
  room: '/chat/rooms/lobby',
  excludeSelf: false,
})
```

### Direct send to current connection

```ts
const { send } = useWsConnection()
send('notification', '/alerts', { message: 'You have a new message' })
```

### Server-wide broadcast

```ts
const { broadcast } = useWsServer()
broadcast('announcement', '/system/alert', { message: 'Server restarting' })
```

### Send to specific connection by ID

```ts
const { getConnection } = useWsServer()
const conn = getConnection(targetId)
if (conn) {
  conn.send('notification', '/direct', { text: 'Hello!' })
}
```

### Access room connections from outside message context

```ts
// From a different handler (e.g., HTTP endpoint)
const { roomConnections } = useWsServer()
const connections = roomConnections('/chat/rooms/lobby')
for (const conn of connections) {
  conn.send('notification', '/chat/rooms/lobby', { text: 'New event!' })
}
```

## Multi-Instance Broadcasting

### WsBroadcastTransport interface

Implement this interface for cross-instance broadcasting (e.g., via Redis, NATS, or any pub/sub system).

```ts
interface WsBroadcastTransport {
  publish(channel: string, payload: string): void | Promise<void>
  subscribe(channel: string, handler: (payload: string) => void): void | Promise<void>
  unsubscribe(channel: string): void | Promise<void>
}
```

Channels follow the pattern `ws:room:{roomName}`. The payload is a JSON-stringified object containing `{ event, path, data, params, excludeId }`.

### Redis example

```ts
import Redis from 'ioredis'
import type { WsBroadcastTransport } from '@moostjs/event-ws'

const pub = new Redis()
const sub = new Redis()
const handlers = new Map<string, (payload: string) => void>()

const redisTransport: WsBroadcastTransport = {
  publish(channel, payload) {
    pub.publish(channel, payload)
  },
  subscribe(channel, handler) {
    handlers.set(channel, handler)
    sub.subscribe(channel)
  },
  unsubscribe(channel) {
    handlers.delete(channel)
    sub.unsubscribe(channel)
  },
}

sub.on('message', (channel, payload) => {
  handlers.get(channel)?.(payload)
})
```

### Pass transport to adapter options

```ts
const ws = new MoostWs({
  wooksWs: { broadcastTransport: redisTransport },
})
```

Or with standalone mode:

```ts
const app = new WsApp()
app.useWsOptions({
  ws: { broadcastTransport: redisTransport },
})
```

## Best practices

- Room names default to the message path — this is the most natural mapping (subscribe to `/chat/rooms/lobby` joins room `/chat/rooms/lobby`)
- Use `excludeSelf: true` (default) for chat-style broadcasts where the sender already has their own confirmation
- Implement `WsBroadcastTransport` for horizontal scaling — without it, broadcasts only reach connections on the same instance
- Connections are automatically removed from all rooms on disconnect (`leaveAll` is called internally)
- Prefer `useWsRooms().broadcast()` for room-scoped messages and `useWsServer().broadcast()` for server-wide announcements
- Use the `context` property from `useWsConnection()` for advanced use (e.g., reading custom context keys set during `@Connect`)

## Gotchas

- `useWsRooms()` is only available in message context — you cannot join/leave rooms from `@Connect`/`@Disconnect` handlers
- The transport channel format is `ws:room:{roomName}` — make sure your Redis/NATS key patterns do not conflict
- Transport messages include `excludeId` to prevent echo on the originating instance, but the exclude only works by connection ID — if the same user has multiple connections, other connections still receive the broadcast
- Empty rooms are automatically cleaned up (removed from the internal Map)
- `useWsServer()` is not a `defineWook` composable — it reads from module-level adapter state, so it works anywhere but requires the adapter to be initialized
- `useWsConnection().send()` silently drops messages if the socket is not in OPEN state (readyState !== 1)
