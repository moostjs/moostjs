# Testing — @moostjs/event-ws

> Unit-testing WebSocket handlers with mock contexts using prepareTestWsMessageContext and prepareTestWsConnectionContext.

## Concepts

`@moostjs/event-ws` re-exports test helpers from `@wooksjs/event-ws` that create mock event contexts for unit-testing handlers and composables without starting a real server.

Two context factories match the two context layers:
1. **`prepareTestWsConnectionContext`** — for `@Connect`/`@Disconnect` handler logic
2. **`prepareTestWsMessageContext`** — for `@Message` handler logic (includes a parent connection context)

Both return a **runner function** `<T>(cb: () => T) => T` that executes a callback inside a fully initialized event context.

## API Reference

### `prepareTestWsMessageContext(options)`

Creates a message context with a parent connection context. Both contexts are fully seeded.

```ts
interface TTestWsMessageContext {
  event: string                                 // required — message event type
  path: string                                  // required — message route path
  data?: unknown                                // parsed message payload
  messageId?: string | number                   // correlation ID
  rawMessage?: Buffer | string                  // raw message before parsing
  id?: string                                   // connection ID (default: 'test-conn-id')
  params?: Record<string, string | string[]>    // pre-set route parameters
  parentCtx?: EventContext                      // optional parent context (e.g. HTTP)
}
```

**Returns:** `<T>(cb: (...a: any[]) => T) => T`

```ts
import { prepareTestWsMessageContext, useWsMessage, useWsConnection } from '@moostjs/event-ws'

const runInCtx = prepareTestWsMessageContext({
  event: 'message',
  path: '/chat/general',
  data: { from: 'Alice', text: 'Hello!' },
  messageId: 1,
})

runInCtx(() => {
  const { data, id, path, event } = useWsMessage<{ from: string; text: string }>()
  expect(data.from).toBe('Alice')
  expect(id).toBe(1)
})
```

### `prepareTestWsConnectionContext(options?)`

Creates a connection context for testing connection lifecycle handlers.

```ts
interface TTestWsConnectionContext {
  id?: string                                   // connection ID (default: 'test-conn-id')
  params?: Record<string, string | string[]>    // pre-set route parameters
  parentCtx?: EventContext                      // optional parent context
}
```

**Returns:** `<T>(cb: (...a: any[]) => T) => T`

```ts
import { prepareTestWsConnectionContext, useWsConnection } from '@moostjs/event-ws'

const runInCtx = prepareTestWsConnectionContext({ id: 'conn-456' })

runInCtx(() => {
  const { id } = useWsConnection()
  expect(id).toBe('conn-456')
})
```

## Common Patterns

### Pattern: Testing message data access

```ts
import { describe, it, expect } from 'vitest'
import { prepareTestWsMessageContext, useWsMessage } from '@moostjs/event-ws'

describe('ChatController', () => {
  it('should access message data', () => {
    const runInCtx = prepareTestWsMessageContext({
      event: 'message',
      path: '/chat/general',
      data: { from: 'Alice', text: 'Hello!' },
      messageId: 1,
    })

    runInCtx(() => {
      const { data, id, path, event } = useWsMessage<{ from: string; text: string }>()
      expect(data.from).toBe('Alice')
      expect(data.text).toBe('Hello!')
      expect(id).toBe(1)
      expect(path).toBe('/chat/general')
      expect(event).toBe('message')
    })
  })
})
```

### Pattern: Testing with route parameters

```ts
import { prepareTestWsMessageContext } from '@moostjs/event-ws'
import { useRouteParams } from '@wooksjs/event-core'

it('should resolve route params', () => {
  const runInCtx = prepareTestWsMessageContext({
    event: 'join',
    path: '/chat/rooms/lobby',
    params: { room: 'lobby' },
    data: { name: 'Alice' },
  })

  runInCtx(() => {
    const { get } = useRouteParams<{ room: string }>()
    expect(get('room')).toBe('lobby')
  })
})
```

### Pattern: Testing connection ID

```ts
it('should access connection id in message context', () => {
  const runInCtx = prepareTestWsMessageContext({
    event: 'join',
    path: '/chat/general',
    data: { name: 'Alice' },
    id: 'conn-123',
  })

  runInCtx(() => {
    const { id } = useWsConnection()
    expect(id).toBe('conn-123')
  })
})
```

### Pattern: Testing with HTTP parent context

For handlers that access HTTP composables from the upgrade request:

```ts
import { EventContext } from '@wooksjs/event-core'
import { prepareTestWsMessageContext, currentConnection } from '@moostjs/event-ws'

it('should have access to parent HTTP context', () => {
  const httpCtx = new EventContext({ logger: console as any })

  const runInCtx = prepareTestWsMessageContext({
    event: 'test',
    path: '/test',
    parentCtx: httpCtx,
  })

  runInCtx(() => {
    const connCtx = currentConnection()
    expect(connCtx.parent).toBe(httpCtx)
  })
})
```

### Pattern: Testing handler functions directly

Extract handler logic into testable functions:

```ts
import { prepareTestWsMessageContext, useWsRooms } from '@moostjs/event-ws'

function handleJoin(room: string, name: string) {
  const { join, broadcast, rooms } = useWsRooms()
  join()
  broadcast('system', { text: `${name} joined` })
  return { joined: true, room, rooms: rooms() }
}

it('should join a room and return room list', () => {
  const runInCtx = prepareTestWsMessageContext({
    event: 'join',
    path: '/chat/general',
    data: { name: 'Alice' },
  })

  const result = runInCtx(() => handleJoin('general', 'Alice'))
  expect(result.joined).toBe(true)
  expect(result.room).toBe('general')
})
```

## Best Practices

- Use test helpers rather than manually constructing `EventContext`
- Keep handler logic testable by extracting business logic into composable-using functions
- Test edge cases with different message data, missing fields, and error conditions
- Use `parentCtx` to simulate HTTP-integrated mode
- Default connection ID is `'test-conn-id'` — override with the `id` option when needed

## Gotchas

- `useWsRooms()` and `useWsServer()` depend on adapter state — for full integration testing with rooms and broadcasting, you may need to set up `WsRoomManager` manually
- The runner function is synchronous — wrap async handler logic in a returned promise if needed
- Route parameters must be pre-set via the `params` option — the test context doesn't run the router
