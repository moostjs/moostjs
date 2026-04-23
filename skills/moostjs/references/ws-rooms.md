# WebSocket Rooms & Broadcasting — @moostjs/event-ws

Room-based connection grouping and local / multi-instance broadcasting. Core setup: [event-ws.md](event-ws.md).

- [Concepts](#concepts)
- [useWsRooms](#usewsrooms)
- [useWsConnection](#usewsconnection)
- [useWsServer](#usewsserver)
- [currentConnection](#currentconnection)
- [Multi-instance: WsBroadcastTransport](#multi-instance-wsbroadcasttransport)
- [Patterns](#patterns)
- [Gotchas](#gotchas)

## Concepts

Rooms = named `Map<string, Set<WsConnection>>` on `WsRoomManager`. A connection may join multiple rooms. Broadcast sends a push to all connections in a room (default: exclude sender).

On broadcast:
1. Local connections in the room receive directly.
2. If a `WsBroadcastTransport` is configured, the message is published to `ws:room:{roomName}` for other instances.
3. Other instances forward to their local connections (`excludeId` prevents echo on the origin instance by connection ID).

Three composables:

| Composable | Scope |
|---|---|
| `useWsRooms()` | message context only — room-scoped join/leave/broadcast for current connection |
| `useWsConnection()` | any WS context — direct send to current connection |
| `useWsServer()` | any context — server-wide broadcast + connection lookup |

## useWsRooms

Defaults the room name to the current message path.

```ts
{
  join(room?): void                         // default: current message path
  leave(room?): void                        // default: current message path
  broadcast(event, data?, options?): void
  rooms(): string[]                         // rooms this connection has joined
}

// WsBroadcastOptions
{
  room?: string          // default: current message path
  excludeSelf?: boolean  // default: true
}
```

## useWsConnection

```ts
{
  id: string
  send(event, path, data?, params?): void
  close(code?, reason?): void
  context: EventContext
}
```

## useWsServer

Server-wide. Reads from adapter state (not EventContext) — works anywhere after adapter init.

```ts
{
  connections(): Map<string, WsConnection>
  broadcast(event, path, data?, params?): void
  getConnection(id: string): WsConnection | undefined
  roomConnections(room: string): Set<WsConnection>
}
```

## currentConnection

Returns the connection `EventContext` regardless of which handler:
- In `@Connect`/`@Disconnect` → `current()` directly.
- In `@Message` → `current().parent` (the connection context).

## Multi-instance: WsBroadcastTransport

```ts
interface WsBroadcastTransport {
  publish(channel: string, payload: string): void | Promise<void>
  subscribe(channel: string, handler: (payload: string) => void): void | Promise<void>
  unsubscribe(channel: string): void | Promise<void>
}
```

Channel format: `ws:room:{roomName}`. Payload = JSON-stringified `{ event, path, data, params, excludeId }`.

### Redis example

```ts
import Redis from 'ioredis'
const pub = new Redis(); const sub = new Redis()
const handlers = new Map<string, (p: string) => void>()

const redisTransport: WsBroadcastTransport = {
  publish(ch, payload) { pub.publish(ch, payload) },
  subscribe(ch, h)     { handlers.set(ch, h); sub.subscribe(ch) },
  unsubscribe(ch)      { handlers.delete(ch); sub.unsubscribe(ch) },
}
sub.on('message', (ch, p) => handlers.get(ch)?.(p))

new MoostWs({ wooksWs: { broadcastTransport: redisTransport } })
// WsApp: .useWsOptions({ ws: { broadcastTransport: redisTransport } })
```

## Patterns

### Join room, broadcast to room

```ts
@Controller('chat')
class ChatController {
  @Message('subscribe',   'rooms/:roomId') sub()   { useWsRooms().join();  return { subscribed: true } }
  @Message('unsubscribe', 'rooms/:roomId') unsub() { useWsRooms().leave(); return { unsubscribed: true } }
  @Message('message',     'rooms/:roomId')
  msg(@MessageData() data: { text: string }) {
    useWsRooms().broadcast('message', data)   // excludes sender
    return { sent: true }
  }
}

// Specific room, include sender:
useWsRooms().broadcast('message', { text: 'hi' }, { room: '/chat/rooms/lobby', excludeSelf: false })
```

### Direct send to current / specific connection

```ts
useWsConnection().send('notification', '/alerts', { message: '...' })

const conn = useWsServer().getConnection(targetId)
conn?.send('notification', '/direct', { text: 'Hello!' })
```

### Server-wide broadcast from non-WS context (e.g. HTTP endpoint)

```ts
useWsServer().broadcast('announcement', '/system/alert', { message: 'Server restarting' })

const conns = useWsServer().roomConnections('/chat/rooms/lobby')
for (const c of conns) c.send('notification', '/chat/rooms/lobby', { text: 'New event!' })
```

## Gotchas

- `useWsRooms()` only in message context — can't join/leave from `@Connect`/`@Disconnect`.
- Default `excludeSelf: true` — sender doesn't get their own broadcast.
- Transport channel is `ws:room:{roomName}` — don't collide in your Redis key space.
- `excludeId` only excludes by connection ID — a user with multiple connections will still see their other sockets receive the broadcast.
- Connections are removed from all rooms on disconnect (`leaveAll` is automatic).
- Empty rooms are auto-cleaned from the Map.
- `useWsServer()` reads module-level adapter state — works anywhere, but requires adapter init first.
- `useWsConnection().send()` silently drops if socket isn't in `OPEN` state (`readyState !== 1`).
- Without a transport, broadcasts only reach same-instance connections.
