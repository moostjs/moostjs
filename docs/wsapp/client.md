# Client

::: warning Experimental
This package is in an experimental phase. The API may change without following semver until it reaches a stable release.
:::

`@wooksjs/ws-client` is a type-safe WebSocket client with RPC support, automatic reconnection, and push event handling. It works in both browsers and Node.js.

For the full API reference, see the [Wooks WS Client Documentation](https://wooks.moost.org/wsapp/client.html).

## Installation

```bash
npm install @wooksjs/ws-client
```

For Node.js, you also need the `ws` package:

```bash
npm install @wooksjs/ws-client ws
```

## Quick Overview

```ts
import { createWsClient } from '@wooksjs/ws-client'

const client = createWsClient('ws://localhost:3000/ws', {
  reconnect: true,
  rpcTimeout: 5000,
})
```

For Node.js, pass the `ws` constructor via the `_WebSocket` option:

```ts
import WebSocket from 'ws'

const client = createWsClient('ws://localhost:3000/ws', {
  _WebSocket: WebSocket as unknown as typeof globalThis.WebSocket,
})
```

The client provides three main communication patterns:

| Method | Description |
|--------|-------------|
| `send(event, path, data?)` | Fire-and-forget — no reply expected |
| `call(event, path, data?)` | RPC — returns a promise with server response |
| `on(event, path, handler)` | Listen for server-initiated push messages |

## Example

```ts
// RPC — join a room and get a response
const result = await client.call<{ joined: boolean }>(
  'join', '/chat/general', { name: 'Alice' },
)

// Listen for broadcasts from the room
client.on('message', '/chat/general', ({ data }) => {
  console.log(`${data.from}: ${data.text}`)
})

// Fire-and-forget — send a chat message
client.send('message', '/chat/general', { from: 'Alice', text: 'Hello!' })
```

## Key Features

- **RPC with correlation** — `call()` auto-generates IDs and matches replies via promises
- **Push listeners** — `on()` supports exact path and wildcard (`/chat/*`) matching
- **Auto-reconnection** — configurable exponential or linear backoff, queues messages while disconnected
- **Error handling** — `call()` rejects with `WsClientError` (timeout, server errors)
- **Lifecycle hooks** — `onOpen()`, `onClose()`, `onError()`, `onReconnect()`
- **Subscriptions** — `subscribe()` with auto-resubscribe on reconnect

See the [full client documentation](https://wooks.moost.org/wsapp/client.html) for detailed API reference, configuration options, reconnection strategies, and error handling.
