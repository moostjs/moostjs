# Rooms & broadcasting — @moostjs/event-ws

> Room management, broadcasting, direct sends, server-wide queries, and multi-instance scaling.

## Concepts

Rooms group WebSocket connections for targeted broadcasting. A connection can join multiple rooms. Room names are strings — by default, the current message path is used as the room name.

Three composables handle communication:
- `useWsRooms()` — room-scoped operations (join, leave, broadcast). Available in message handlers only.
- `useWsConnection()` — direct send to the current connection. Available in all handlers.
- `useWsServer()` — server-wide operations (broadcast to all, query connections). Available in any context.

## API Reference

### `useWsRooms()`

Room management for the current connection. Only available in `@Message` handlers.

```ts
const { join, leave, broadcast, rooms } = useWsRooms()
```

| Method | Description |
|--------|-------------|
| `join(room?)` | Join a room (default: current message path) |
| `leave(room?)` | Leave a room (default: current message path) |
| `broadcast(event, data?, opts?)` | Broadcast to room members |
| `rooms()` | List rooms this connection has joined (`string[]`) |

**Broadcast options:**
```ts
broadcast('message', data, {
  room: '/custom-room',  // target a different room (default: current path)
  excludeSelf: false,     // include the sender (default: true)
})
```

### `useWsConnection()`

Access the current WebSocket connection. Available in all handler types.

```ts
const { id, send, close } = useWsConnection()
```

| Property/Method | Description |
|----------------|-------------|
| `id` | Connection UUID (`string`) |
| `send(event, path, data?, params?)` | Push a message to this client |
| `close(code?, reason?)` | Close the connection |
| `context` | The connection `EventContext` |

### `useWsServer()`

Server-wide operations. Available in any context.

```ts
const server = useWsServer()
```

| Method | Description |
|--------|-------------|
| `broadcast(event, path, data?)` | Broadcast to ALL connected clients |
| `connections()` | Get all connections (`Map<string, WsConnection>`) |
| `roomConnections(room)` | Get connections in a room (`Set<WsConnection>`) |
| `getConnection(id)` | Get connection by ID (`WsConnection \| undefined`) |

### `currentConnection()`

Returns the connection `EventContext` regardless of context level:
- In `@Connect`/`@Disconnect`: returns `current()` directly
- In `@Message`: returns `current().parent` (the connection context)

## Common Patterns

### Pattern: Join a room and broadcast

```ts
@Controller('chat')
export class ChatController {
  @Message('join', ':room')
  join(
    @Param('room') room: string,
    @ConnectionId() id: string,
    @MessageData() data: { name: string },
  ) {
    const { join, broadcast, rooms } = useWsRooms()
    join() // joins room matching current path (e.g. "/chat/general")
    broadcast('system', { text: `${data.name} joined` })
    return { joined: true, room, rooms: rooms() }
  }
}
```

### Pattern: Broadcast a message to a room

```ts
@Message('message', ':room')
onMessage(@MessageData() data: { from: string; text: string }) {
  const { broadcast } = useWsRooms()
  broadcast('message', { from: data.from, text: data.text })
  // all room members except sender receive the message
}
```

### Pattern: Direct send to current connection

```ts
@Message('notify', '/self')
notify() {
  const { send } = useWsConnection()
  send('notification', '/alerts', { text: 'Just for you' })
}
```

### Pattern: Server-wide broadcast

```ts
@Message('admin', '/announce')
announce(@MessageData() data: { text: string }) {
  const server = useWsServer()
  server.broadcast('announcement', '/announce', { text: data.text })
  return { announced: true }
}
```

### Pattern: Send to a specific connection by ID

```ts
@Message('dm', '/direct')
directMessage(@MessageData() data: { targetId: string; text: string }) {
  const server = useWsServer()
  const target = server.getConnection(data.targetId)
  if (target) {
    target.send('dm', '/direct', { text: data.text })
  }
}
```

## Multi-Instance Broadcasting

For horizontal scaling, implement `WsBroadcastTransport` to relay room broadcasts across instances:

```ts
import type { WsBroadcastTransport } from '@moostjs/event-ws'

class RedisBroadcastTransport implements WsBroadcastTransport {
  publish(channel: string, payload: string) {
    redis.publish(channel, payload)
  }
  subscribe(channel: string, handler: (payload: string) => void) {
    redis.subscribe(channel, handler)
  }
  unsubscribe(channel: string) {
    redis.unsubscribe(channel)
  }
}
```

Pass it in adapter options:

```ts
const ws = new MoostWs({
  httpApp: http.getHttpApp(),
  wooksWs: {
    broadcastTransport: new RedisBroadcastTransport(),
  },
})
```

Channels follow the pattern `ws:room:<room-path>`.

### WsBroadcastTransport Interface

```ts
interface WsBroadcastTransport {
  publish(channel: string, payload: string): void | Promise<void>
  subscribe(channel: string, handler: (payload: string) => void): void | Promise<void>
  unsubscribe(channel: string): void | Promise<void>
}
```

## Best Practices

- Let rooms auto-clean on disconnect — don't manually leave in `@Disconnect` handlers
- Use `excludeSelf: true` (default) to prevent echo in chat-like scenarios
- Use `useWsServer()` sparingly — prefer room-scoped broadcasts over server-wide
- For large-scale deployments, implement `WsBroadcastTransport` with Redis/NATS

## Gotchas

- `useWsRooms()` throws if called outside a message context (e.g. inside `@Connect`)
- `join()` without arguments uses the current message path as the room name, including the controller prefix
- `useWsConnection().send()` silently drops messages if the socket is not in OPEN state
- Broadcast `excludeId` only prevents echo on the originating server instance — the same user's other connections still receive it
