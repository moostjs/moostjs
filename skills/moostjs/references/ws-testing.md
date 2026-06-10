# WebSocket Testing — @moostjs/event-ws

Test helpers (re-exported from `@wooksjs/event-ws`) that create initialized `EventContext` instances with mock `WsSocket`s. Use to unit-test composables and handler logic without a real server. Core setup: [event-ws.md](event-ws.md). Rooms/broadcasting: [ws-rooms.md](ws-rooms.md).

- [Helpers](#helpers)
- [Patterns](#patterns)
- [Gotchas](#gotchas)

Two context types match the two context layers:
1. **Connection** — for `@Connect`/`@Disconnect` and connection composables.
2. **Message** — for `@Message` handlers (includes a parent connection context).

Each helper returns a **runner**: `<T>(cb: (...a: any[]) => T) => T`. Call it with a callback that runs inside the scoped context.

## Helpers

### prepareTestWsMessageContext(options)

Options (`TTestWsMessageContext`, importable from `@moostjs/event-ws`):

| Option | Required | Default | Effect |
|---|---|---|---|
| `event` | yes | — | message event type (`useWsMessage().event`) |
| `path` | yes | — | message route path (`useWsMessage().path`) |
| `data` | no | `undefined` | parsed payload (`useWsMessage().data`) |
| `messageId` | no | `undefined` | correlation id (`useWsMessage().id`) |
| `rawMessage` | no | `JSON.stringify` of the message | raw frame (`useWsMessage().raw`) |
| `id` | no | `'test-conn-id'` | connection id on the parent connection ctx |
| `params` | no | — | pre-set route params for `useRouteParams()` |
| `parentCtx` | no | — | parent of the connection ctx (e.g. HTTP upgrade ctx) |

```ts
import { prepareTestWsMessageContext, useWsMessage } from '@moostjs/event-ws'

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

Options (`TTestWsConnectionContext`, importable from `@moostjs/event-ws`):

| Option | Default | Effect |
|---|---|---|
| `id` | `'test-conn-id'` | connection id |
| `params` | — | pre-set route params |
| `parentCtx` | — | parent context (e.g. HTTP upgrade ctx) |

`useWsConnection()` reads module-level adapter state — construct an adapter once in test setup before calling it (gotcha 1):

```ts
import { MoostWs, prepareTestWsConnectionContext, useWsConnection } from '@moostjs/event-ws'

beforeAll(() => { new MoostWs() })  // initializes adapter state

const run = prepareTestWsConnectionContext({ id: 'conn-1' })
run(() => {
  const { id } = useWsConnection()
  expect(id).toBe('conn-1')
})
```

## Patterns

### Route params

`useRouteParams` is not exported by `@moostjs/event-ws` — import from `@wooksjs/event-core` (or `@wooksjs/event-ws`):

```ts
import { useRouteParams } from '@wooksjs/event-core'

const run = prepareTestWsMessageContext({
  event: 'message', path: '/chat/rooms/lobby',
  params: { roomId: 'lobby' }, data: { text: 'hi' },
})
run(() => { expect(useRouteParams().params.roomId).toBe('lobby') })
```

### HTTP parent (integrated mode)

`EventContext` is a runtime export of `@wooksjs/event-core` only (type-only in `moost`/`@wooksjs/event-ws`):

```ts
import { EventContext } from '@wooksjs/event-core'

const httpCtx = new EventContext({ logger: console as any })
const run = prepareTestWsMessageContext({ event: 'test', path: '/test', parentCtx: httpCtx })
run(() => { expect(currentConnection().parent).toBe(httpCtx) })
```

### Extract handler logic for testability

```ts
import { useRouteParams } from '@wooksjs/event-core'

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

| # | Invariant |
|---|---|
| 1 | `useWsConnection()`, `useWsRooms()`, `useWsServer()` read module-level adapter state and throw `[event-ws] No active WooksWs adapter` until an adapter exists — construct one in test setup (`new MoostWs()`). `useWsMessage()`, `useRouteParams()`, `currentConnection()` need no adapter. |
| 2 | Even with an adapter, the test connection is not registered in its connections map: `useWsConnection().id`/`close()` work, but `send()` and all `useWsRooms()` operations fail. Test rooms/broadcast through a real running server. |
| 3 | `prepareTestWsMessageContext` requires `event` + `path` (not optional). |
| 4 | Mock socket has `readyState = 1` (OPEN), so open-state guards pass. |
| 5 | Logger is `console`; the helpers don't accept a logger override — wrap with a custom `EventContext` as `parentCtx` if needed. |
| 6 | To assert outgoing sends, construct a `WsConnection` (runtime export of `@wooksjs/event-ws`, type-only in `@moostjs/event-ws`) with your own mock socket instead of the built-in helpers. |
