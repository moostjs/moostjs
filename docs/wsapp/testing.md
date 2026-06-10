# Testing


`@moostjs/event-ws` re-exports test helpers from `@wooksjs/event-ws` that let you unit-test WebSocket handlers and composables without starting a real server.

[[toc]]

## Test Helpers

Two context factories match the two context layers:

1. **`prepareTestWsConnectionContext`** — for testing `@Connect`/`@Disconnect` handler logic
2. **`prepareTestWsMessageContext`** — for testing `@Message` handler logic (includes a parent connection context)

Both return a **runner function** `<T>(cb: () => T) => T` that executes a callback inside a fully initialized event context. Internally the helpers seed the context with the `wsConnectionKind` / `wsMessageKind` event-kind descriptors (re-exported by `@moostjs/event-ws`), so composables read the same slots as in production.

## Testing Message Handlers

Use `prepareTestWsMessageContext` to create a mock message context with event, path, data, and optional route parameters:

```ts
import { describe, it, expect, beforeAll } from 'vitest'
import {
  MoostWs,
  prepareTestWsMessageContext,
  useWsMessage,
  useWsConnection,
} from '@moostjs/event-ws'

describe('ChatController', () => {
  // useWsConnection() reads module-level adapter state —
  // constructing the adapter once initializes it (not needed for useWsMessage)
  beforeAll(() => {
    new MoostWs()
  })

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

::: warning
`useWsConnection()` requires a live adapter in the process (see the `beforeAll` above) — without it, the composable throws `[event-ws] No active WooksWs adapter`. Even with the adapter constructed, the test connection is not registered in the adapter's connections map, so `id` and `close()` work but `send()` does not.
:::

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
import { describe, it, expect, beforeAll } from 'vitest'
import {
  MoostWs,
  prepareTestWsConnectionContext,
  useWsConnection,
} from '@moostjs/event-ws'

describe('LifecycleController', () => {
  beforeAll(() => {
    new MoostWs() // initializes adapter state for useWsConnection()
  })

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

You can test your handler logic by calling it inside the test context. Keep the logic on adapter-state-free composables (`useWsMessage`, `useRouteParams`) so the test is self-contained:

```ts
import { prepareTestWsMessageContext, useWsMessage } from '@moostjs/event-ws'
import { useRouteParams } from '@wooksjs/event-core'

// Your handler logic (extracted from controller for testing)
function handleChatMessage() {
  const { data } = useWsMessage<{ text: string }>()
  const { get } = useRouteParams<{ room: string }>()
  return { room: get('room'), echoed: data.text }
}

it('should handle a chat message', () => {
  const runInCtx = prepareTestWsMessageContext({
    event: 'message',
    path: '/chat/general',
    params: { room: 'general' },
    data: { text: 'Hello!' },
  })

  const result = runInCtx(() => handleChatMessage())
  expect(result).toEqual({ room: 'general', echoed: 'Hello!' })
})
```

::: warning Adapter-state-dependent composables
`useWsConnection()`, `useWsRooms()`, and `useWsServer()` read module-level adapter state and throw `[event-ws] No active WooksWs adapter` unless an adapter exists in the process. The only public way to initialize that state is to construct an adapter in test setup (e.g. `new MoostWs()`). Even then, the test connection is not registered with the adapter, so room operations (`join`, `broadcast`, `rooms`) and `useWsConnection().send()` still fail — test room and broadcast logic through a real running server instead.
:::

## Best Practices

- **Use test helpers** rather than manually constructing `EventContext` — they ensure proper context seeding
- **Keep handler logic testable** by extracting business logic into functions that use composables, then test those functions inside mock contexts
- **Test edge cases** with different message data, missing fields, and error conditions
- **Use `parentCtx`** to simulate HTTP-integrated mode when testing composables that traverse the parent context chain
- **Default connection ID** is `'test-conn-id'` — override with the `id` option when testing connection-specific logic
