# WebSocket Testing — @moostjs/event-ws

Test helpers (re-exported from `@wooksjs/event-ws`) that create fully initialized `EventContext` instances with mock `WsSocket`s. Use to unit-test composables and handler logic without a real server.

- [Helpers](#helpers)
- [Patterns](#patterns)
- [Gotchas](#gotchas)

Two context types match the two context layers:
1. **Connection** — for `@Connect`/`@Disconnect` and connection composables.
2. **Message** — for `@Message` handlers (includes a parent connection context).

Each helper returns a **runner**: `<T>(cb: (...a: any[]) => T) => T`. Call it with a callback that runs inside the scoped context.

## Helpers

### prepareTestWsMessageContext(options)

```ts
interface TTestWsMessageContext extends TTestWsConnectionContext {
  event: string                // required
  path: string                 // required
  data?: unknown
  messageId?: string | number
  rawMessage?: Buffer | string // default: JSON.stringify(message)
}
```

```ts
const run = prepareTestWsMessageContext({
  event: 'message', path: '/chat/lobby', data: { text: 'hello' }, messageId: 42,
})
run(() => {
  const { data, id, path } = useWsMessage<{ text: string }>()
  expect(data.text).toBe('hello')
  expect(id).toBe(42)
  expect(path).toBe('/chat/lobby')
})
```

### prepareTestWsConnectionContext(options?)

```ts
interface TTestWsConnectionContext {
  id?: string                                  // default 'test-conn-id'
  params?: Record<string, string | string[]>   // pre-set route params
  parentCtx?: EventContext                     // optional parent (e.g. HTTP)
}
```

```ts
const run = prepareTestWsConnectionContext({ id: 'conn-1' })
run(() => {
  const { id } = useWsConnection()
  expect(id).toBe('conn-1')
})
```

## Patterns

### Route params

```ts
const run = prepareTestWsMessageContext({
  event: 'message', path: '/chat/rooms/lobby',
  params: { roomId: 'lobby' }, data: { text: 'hi' },
})
run(() => { expect(useRouteParams().params.roomId).toBe('lobby') })
```

### HTTP parent (integrated mode)

```ts
const httpCtx = new EventContext({ logger: console as any })
const run = prepareTestWsMessageContext({ event: 'test', path: '/test', parentCtx: httpCtx })
run(() => { expect(currentConnection().parent).toBe(httpCtx) })
```

### Extract handler logic for testability

```ts
function handleChatMessage() {
  const { data } = useWsMessage<{ text: string }>()
  const { params } = useRouteParams()
  return { received: data.text, room: params.roomId }
}

const run = prepareTestWsMessageContext({
  event: 'message', path: '/chat/rooms/lobby',
  params: { roomId: 'lobby' }, data: { text: 'hello' },
})
expect(run(() => handleChatMessage())).toEqual({ received: 'hello', room: 'lobby' })
```

### RPC message

```ts
const run = prepareTestWsMessageContext({
  event: 'rpc', path: '/users/123',
  params: { id: '123' }, data: { fields: ['name', 'email'] }, messageId: 'req-1',
})
run(() => {
  const { id, data } = useWsMessage<{ fields: string[] }>()
  expect(id).toBe('req-1')
  expect(data.fields).toEqual(['name', 'email'])
})
```

## Gotchas

- Mock socket `readyState = 1` (OPEN) — `send()` passes the guard.
- `prepareTestWsMessageContext` requires `event` + `path` (not optional).
- Logger is `console`; override isn't directly supported via `TTestWsConnectionContext` — wrap with a custom `EventContext` if needed.
- `setAdapterState` is internal — signature may change across `@wooksjs/event-ws` versions.
- `useWsRooms()` needs both message context AND initialized adapter state — without `setAdapterState`, room operations fail.
- To assert outgoing sends, use `WsConnection` with a custom mock socket directly (not the built-in helpers).
