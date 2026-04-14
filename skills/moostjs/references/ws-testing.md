# WebSocket Testing — @moostjs/event-ws

Test helpers for creating mock WS contexts and running handler code outside a real server.

For core WS setup, see [event-ws.md].

## Concepts

`@moostjs/event-ws` re-exports test utilities from `@wooksjs/event-ws` that create fully initialized `EventContext` instances with mock WebSocket sockets. Use these to unit-test composables and handler logic without starting a server or establishing real connections.

Two context types match the two context layers:

1. **Connection context** — for testing `@Connect`/`@Disconnect` handlers and connection composables
2. **Message context** — for testing `@Message` handlers (includes a parent connection context)

Each helper returns a **runner function** `<T>(cb: (...a: any[]) => T) => T` that executes a callback inside the scoped context.

## API Reference

### prepareTestWsMessageContext(options)

Create a message context with a parent connection context. Both contexts are fully seeded. Use this for testing `@Message` handler logic.

```ts
import { prepareTestWsMessageContext } from '@moostjs/event-ws'
```

Options:

```ts
interface TTestWsMessageContext extends TTestWsConnectionContext {
  event: string               // required — message event type
  path: string                // required — message path
  data?: unknown              // parsed message payload
  messageId?: string | number // correlation ID
  rawMessage?: Buffer | string // raw message (default: JSON.stringify of the message)
}
```

Returns: `<T>(cb: (...a: any[]) => T) => T`

```ts
import { prepareTestWsMessageContext, useWsMessage } from '@moostjs/event-ws'

const runInCtx = prepareTestWsMessageContext({
  event: 'message',
  path: '/chat/lobby',
  data: { text: 'hello' },
  messageId: 42,
})

runInCtx(() => {
  const { data, id, path } = useWsMessage<{ text: string }>()
  expect(data.text).toBe('hello')
  expect(id).toBe(42)
  expect(path).toBe('/chat/lobby')
})
```

### prepareTestWsConnectionContext(options?)

Create a connection context with a mock `WsSocket`. Use this for testing `@Connect`/`@Disconnect` handler logic and connection-scoped composables.

```ts
import { prepareTestWsConnectionContext } from '@moostjs/event-ws'
```

Options:

```ts
interface TTestWsConnectionContext {
  id?: string                              // default: 'test-conn-id'
  params?: Record<string, string | string[]> // pre-set route params
  parentCtx?: EventContext                 // optional parent (e.g., HTTP context)
}
```

Returns: `<T>(cb: (...a: any[]) => T) => T`

```ts
import { prepareTestWsConnectionContext, useWsConnection } from '@moostjs/event-ws'

const runInCtx = prepareTestWsConnectionContext({ id: 'conn-1' })

runInCtx(() => {
  const { id } = useWsConnection()
  expect(id).toBe('conn-1')
})
```

## Common Patterns

### Testing message data access

```ts
import { prepareTestWsMessageContext, useWsMessage } from '@moostjs/event-ws'

describe('ChatController', () => {
  it('should parse message data', () => {
    const runInCtx = prepareTestWsMessageContext({
      event: 'message',
      path: '/chat/rooms/lobby',
      data: { text: 'hello', sender: 'alice' },
    })

    runInCtx(() => {
      const { data } = useWsMessage<{ text: string, sender: string }>()
      expect(data.text).toBe('hello')
      expect(data.sender).toBe('alice')
    })
  })
})
```

### Testing with route parameters

```ts
import { prepareTestWsMessageContext } from '@moostjs/event-ws'
import { useRouteParams } from '@wooksjs/event-core'

const runInCtx = prepareTestWsMessageContext({
  event: 'message',
  path: '/chat/rooms/lobby',
  params: { roomId: 'lobby' },
  data: { text: 'hi' },
})

runInCtx(() => {
  const { params } = useRouteParams()
  expect(params.roomId).toBe('lobby')
})
```

### Testing connection ID

```ts
import { prepareTestWsConnectionContext, useWsConnection } from '@moostjs/event-ws'

const runInCtx = prepareTestWsConnectionContext({ id: 'user-42' })

runInCtx(() => {
  const { id } = useWsConnection()
  expect(id).toBe('user-42')
})
```

### Testing with HTTP parent context

Simulate HTTP-integrated mode by providing a parent `EventContext`.

```ts
import { EventContext } from '@wooksjs/event-core'
import { prepareTestWsMessageContext, currentConnection } from '@moostjs/event-ws'

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
```

### Testing handler functions directly

Extract handler logic into standalone functions and test them with mock contexts.

```ts
import {
  prepareTestWsMessageContext,
  useWsMessage,
} from '@moostjs/event-ws'
import { useRouteParams } from '@wooksjs/event-core'

// Handler logic extracted from the controller
function handleChatMessage() {
  const { data } = useWsMessage<{ text: string }>()
  const { params } = useRouteParams()
  return { received: data.text, room: params.roomId }
}

describe('handleChatMessage', () => {
  it('should return received text and room', () => {
    const runInCtx = prepareTestWsMessageContext({
      event: 'message',
      path: '/chat/rooms/lobby',
      params: { roomId: 'lobby' },
      data: { text: 'hello' },
    })

    const result = runInCtx(() => handleChatMessage())
    expect(result).toEqual({ received: 'hello', room: 'lobby' })
  })
})
```

### Testing composables that depend on adapter state

When testing composables that access adapter state (`useWsRooms`, `useWsServer`), the test helpers seed the context with mock data. For rooms testing, ensure you provide a `WsRoomManager` via the connection context's adapter state. The `prepareTestWsMessageContext` and `prepareTestWsConnectionContext` helpers handle basic context setup automatically.

### Testing RPC message (with correlation ID)

```ts
import { prepareTestWsMessageContext, useWsMessage } from '@moostjs/event-ws'

const runInCtx = prepareTestWsMessageContext({
  event: 'rpc',
  path: '/users/123',
  params: { id: '123' },
  data: { fields: ['name', 'email'] },
  messageId: 'req-1',
})

runInCtx(() => {
  const { id, data } = useWsMessage<{ fields: string[] }>()
  expect(id).toBe('req-1')
  expect(data.fields).toEqual(['name', 'email'])
})
```

## Best practices

- Always use the test helpers rather than manually constructing `EventContext` — they ensure proper kind seeding and context layering
- Set up adapter state before testing composables that depend on it (`useWsRooms`, `useWsServer`)
- Use `parentCtx` to simulate HTTP-integrated mode when testing composables that traverse the parent chain
- The mock `WsSocket` has no-op methods — if you need to assert on sent messages, create a custom mock and use `WsConnection` directly
- Extract handler logic into standalone functions for easier testability — test the function directly with mock contexts
- Type `useWsMessage<T>()` with your expected payload type for compile-time safety in tests

## Gotchas

- The mock socket's `readyState` is set to `1` (OPEN) by default — `send()` calls pass the guard check
- `prepareTestWsMessageContext` requires `event` and `path` — they are not optional
- Test contexts use `console` as the logger — override is not directly supported via `TTestWsConnectionContext`; wrap with a custom `EventContext` if needed
- `setAdapterState` is an internal API — its signature may change between versions of `@wooksjs/event-ws`
- `useWsRooms()` requires both a message context and initialized adapter state — if you only call `prepareTestWsMessageContext` without `setAdapterState`, room operations will fail
