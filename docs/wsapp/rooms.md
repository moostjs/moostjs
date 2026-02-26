# Rooms & Broadcasting

::: warning Experimental
This package is in an experimental phase. The API may change without following semver until it reaches a stable release.
:::

Rooms let you group connections and broadcast messages to all members. A connection can join multiple rooms. Room names are strings — by default, the current message path is used as the room name.

[[toc]]

## Room Management

Use the `useWsRooms()` composable inside message handlers to join, leave, and broadcast to rooms.

### Joining a Room

```ts
import { Message, MessageData, ConnectionId } from '@moostjs/event-ws'
import { useWsRooms } from '@moostjs/event-ws'
import { Controller, Param } from 'moost'

@Controller('chat')
export class ChatController {
  @Message('join', ':room')
  join(
    @Param('room') room: string,
    @ConnectionId() id: string,
    @MessageData() data: { name: string },
  ) {
    const { join, broadcast, rooms } = useWsRooms()

    join() // joins the current path as room (e.g. "/chat/general")

    broadcast('system', { text: `${data.name} joined` })

    return { joined: true, room, rooms: rooms() }
  }
}
```

`join()` without arguments uses the current message path as the room name. You can pass a custom room name:

```ts
join('/custom-room-name')
```

### Leaving a Room

```ts
@Message('leave', ':room')
leave(@Param('room') room: string) {
  const { leave, broadcast, rooms } = useWsRooms()

  broadcast('system', { text: 'Someone left' })
  leave() // leaves the current path room

  return { left: true, rooms: rooms() }
}
```

::: tip
When a connection closes, it is automatically removed from all rooms. You don't need to manually leave rooms in `@Disconnect` handlers.
:::

### Listing Rooms

```ts
const { rooms } = useWsRooms()
const joinedRooms = rooms() // string[]
```

## Broadcasting

### Room Broadcast

`broadcast()` from `useWsRooms()` sends a message to all connections in the current room, **excluding the sender** by default:

```ts
@Message('message', ':room')
onMessage(@MessageData() data: { from: string; text: string }) {
  const { broadcast } = useWsRooms()
  broadcast('message', { from: data.from, text: data.text })
}
```

Recipients receive a push message:
```json
{
  "event": "message",
  "path": "/chat/general",
  "data": { "from": "Alice", "text": "Hello!" }
}
```

#### Broadcast Options

```ts
broadcast('message', data, {
  room: '/custom-room',  // target a different room
  excludeSelf: false,    // include the sender (default: true)
})
```

### Direct Send

Use `useWsConnection()` to send a message to the current connection:

```ts
import { useWsConnection } from '@moostjs/event-ws'

@Message('notify', '/self')
notify() {
  const { send } = useWsConnection()
  send('notification', '/alerts', { text: 'Just for you' })
}
```

### Server-Wide Broadcast

Use `useWsServer()` to broadcast to **all** connected clients, regardless of room membership:

```ts
import { useWsServer } from '@moostjs/event-ws'

@Message('admin', '/announce')
announce(@MessageData() data: { text: string }) {
  const server = useWsServer()
  server.broadcast('announcement', '/announce', { text: data.text })
  return { announced: true }
}
```

### Send to a Specific Connection

```ts
import { useWsServer } from '@moostjs/event-ws'

@Message('dm', '/direct')
directMessage(@MessageData() data: { targetId: string; text: string }) {
  const server = useWsServer()
  const target = server.getConnection(data.targetId)
  if (target) {
    target.send('dm', '/direct', { text: data.text })
  }
}
```

## Server Queries

### All Connections

```ts
const server = useWsServer()
const allConnections = server.connections() // Map<string, WsConnection>
console.log('Total:', allConnections.size)
```

### Room Connections

```ts
const server = useWsServer()
const roomConns = server.roomConnections('/chat/general') // Set<WsConnection>
console.log('Users in room:', roomConns.size)
```

### Single Connection by ID

```ts
const server = useWsServer()
const conn = server.getConnection(connectionId) // WsConnection | undefined
```

## Multi-Instance Broadcasting

For horizontal scaling (multiple server instances), implement the `WsBroadcastTransport` interface to relay room broadcasts across instances via Redis, NATS, or any pub/sub system:

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

Pass it when creating the WS adapter:

```ts
const ws = new MoostWs({
  httpApp: http.getHttpApp(),
  wooksWs: {
    broadcastTransport: new RedisBroadcastTransport(),
  },
})
```

Channels follow the pattern `ws:room:<room-path>`.

## Composable Reference

| Composable | Method | Description |
|-----------|--------|-------------|
| `useWsRooms()` | `join(room?)` | Join a room (default: current path) |
| | `leave(room?)` | Leave a room |
| | `broadcast(event, data?, opts?)` | Broadcast to room members |
| | `rooms()` | List joined rooms |
| `useWsServer()` | `broadcast(event, path, data?)` | Broadcast to all clients |
| | `connections()` | Get all connections |
| | `roomConnections(room)` | Get connections in a room |
| | `getConnection(id)` | Get connection by ID |
| `useWsConnection()` | `send(event, path, data?)` | Send to current connection |
| | `id` | Connection UUID |
| | `close()` | Close the connection |
