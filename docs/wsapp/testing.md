# Testing

::: warning Experimental
This package is in an experimental phase. The API may change without following semver until it reaches a stable release.
:::

`@moostjs/event-ws` re-exports test helpers from `@wooksjs/event-ws` that let you unit-test WebSocket handlers and composables without starting a real server.

[[toc]]

## Test Helpers

Two context factories match the two context layers:

1. **`prepareTestWsConnectionContext`** — for testing `@Connect`/`@Disconnect` handler logic
2. **`prepareTestWsMessageContext`** — for testing `@Message` handler logic (includes a parent connection context)

Both return a **runner function** `<T>(cb: () => T) => T` that executes a callback inside a fully initialized event context.

## Testing Message Handlers

Use `prepareTestWsMessageContext` to create a mock message context with event, path, data, and optional route parameters:

```ts
import { describe, it, expect } from 'vitest'
import {
  prepareTestWsMessageContext,
  useWsMessage,
  useWsConnection,
} from '@moostjs/event-ws'

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

  it('should access connection id', () => {
    const runInCtx = prepareTestWsMessageContext({
      event: 'join',
      path: '/chat/general',
      data: { name: 'Alice' },
      id: 'conn-123', // custom connection ID
    })

    runInCtx(() => {
      const { id } = useWsConnection()
      expect(id).toBe('conn-123')
    })
  })
})
```

### Options

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

## Testing Connection Handlers

Use `prepareTestWsConnectionContext` for connection lifecycle handler logic:

```ts
import { describe, it, expect } from 'vitest'
import {
  prepareTestWsConnectionContext,
  useWsConnection,
} from '@moostjs/event-ws'

describe('LifecycleController', () => {
  it('should access connection info', () => {
    const runInCtx = prepareTestWsConnectionContext({
      id: 'conn-456',
    })

    runInCtx(() => {
      const { id } = useWsConnection()
      expect(id).toBe('conn-456')
    })
  })
})
```

### Options

```ts
interface TTestWsConnectionContext {
  id?: string                                   // connection ID (default: 'test-conn-id')
  params?: Record<string, string | string[]>    // pre-set route parameters
  parentCtx?: EventContext                      // optional parent context
}
```

## Testing with Route Parameters

Pre-set route parameters to test handlers that use `@Param` or `useRouteParams`:

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

## Testing with HTTP Parent Context

When testing handlers that access HTTP composables (like `useHeaders` from the upgrade request), pass a parent HTTP context:

```ts
import { EventContext } from '@wooksjs/event-core'
import { prepareTestWsMessageContext, currentConnection } from '@moostjs/event-ws'

it('should have access to parent HTTP context', () => {
  const httpCtx = new EventContext({ logger: console as any })
  // Seed httpCtx with HTTP-specific data if needed

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

## Testing Handler Functions Directly

You can test your handler methods by calling them inside the test context:

```ts
import { prepareTestWsMessageContext, useWsRooms } from '@moostjs/event-ws'

// Your handler function (extracted from controller for testing)
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

::: warning
Testing composables that depend on adapter state (`useWsRooms`, `useWsServer`) requires the adapter state to be initialized. For full integration testing with rooms and broadcasting, consider using the `WsRoomManager` class and setting up adapter state manually. See the [Wooks testing documentation](https://wooks.moost.org/wsapp/testing.html) for advanced patterns.
:::

## Best Practices

- **Use test helpers** rather than manually constructing `EventContext` — they ensure proper context seeding
- **Keep handler logic testable** by extracting business logic into functions that use composables, then test those functions inside mock contexts
- **Test edge cases** with different message data, missing fields, and error conditions
- **Use `parentCtx`** to simulate HTTP-integrated mode when testing composables that traverse the parent context chain
- **Default connection ID** is `'test-conn-id'` — override with the `id` option when testing connection-specific logic
