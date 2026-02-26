# Quick Start

This guide shows you how to build a WebSocket application with Moost.

`@moostjs/event-ws` wraps [`@wooksjs/event-ws`](https://wooks.moost.org/wsapp/) and brings
decorator-based routing, dependency injection, interceptors, and pipes to your WebSocket handlers.

## Installation

```bash
npm install @moostjs/event-ws
```

::: tip
For HTTP-integrated mode (recommended), you also need `@moostjs/event-http`:
```bash
npm install @moostjs/event-ws @moostjs/event-http
```
:::

## Standalone Mode

The quickest way to get a WebSocket server running. All incoming connections are accepted automatically — no HTTP server or upgrade route is needed.

```ts
import { WsApp, Message, WsData, WsConnectionId, Connect } from '@moostjs/event-ws'
import { Controller } from 'moost'

@Controller()
class ChatController {
  @Connect()
  onConnect(@WsConnectionId() id: string) {
    console.log(`Connected: ${id}`)
  }

  @Message('echo', '/echo')
  echo(@WsData() data: unknown) {
    return data // replies to the client
  }
}

new WsApp()
  .controllers(ChatController)
  .start(3000)
```

`WsApp` is a convenience class that extends `Moost` and sets up a standalone `MoostWs` adapter for you.

## HTTP-Integrated Mode

The recommended approach for production. The WebSocket server shares the HTTP port and requires an explicit upgrade route, giving you full control over which paths accept WebSocket connections and how they are authenticated.

### main.ts

```ts
import { MoostHttp } from '@moostjs/event-http'
import { MoostWs } from '@moostjs/event-ws'
import { Moost } from 'moost'

import { AppController } from './app.controller'
import { ChatController } from './chat.controller'

const app = new Moost()
const http = new MoostHttp()
const ws = new MoostWs({ httpApp: http.getHttpApp() })

app.adapter(http)
app.adapter(ws)
app.registerControllers(AppController, ChatController)

await http.listen(3000)
await app.init()
```

### app.controller.ts

```ts
import { Get, Upgrade } from '@moostjs/event-http'
import type { WooksWs } from '@moostjs/event-ws'
import { Controller, Inject } from 'moost'

@Controller()
export class AppController {
  constructor(@Inject('WooksWs') private ws: WooksWs) {}

  @Get('health')
  health() {
    return { status: 'ok' }
  }

  @Upgrade('ws')
  upgrade() {
    return this.ws.upgrade()
  }
}
```

### chat.controller.ts

```ts
import { Message, WsData, WsConnectionId, useWsRooms } from '@moostjs/event-ws'
import { Controller, Param } from 'moost'

@Controller('chat')
export class ChatController {
  @Message('join', ':room')
  join(
    @Param('room') room: string,
    @WsConnectionId() id: string,
    @WsData() data: { name: string },
  ) {
    const { join, broadcast } = useWsRooms()
    join()
    broadcast('system', { text: `${data.name} joined` })
    return { joined: true, room }
  }

  @Message('message', ':room')
  onMessage(@WsData() data: { from: string; text: string }) {
    const { broadcast } = useWsRooms()
    broadcast('message', data)
  }
}
```

Clients connect to `ws://localhost:3000/ws` and send JSON messages routed by `event` and `path` fields. See the [wire protocol](./protocol) for message format details.

## Connecting a Client

Use `@wooksjs/ws-client` for a type-safe client with RPC support, reconnection, and push event handling:

```bash
npm install @wooksjs/ws-client
```

```ts
import { createWsClient } from '@wooksjs/ws-client'

const client = createWsClient('ws://localhost:3000/ws', {
  reconnect: true,
  rpcTimeout: 5000,
})

// RPC call — returns a promise with the server response
const result = await client.call('join', '/chat/general', { name: 'Alice' })
console.log(result) // { joined: true, room: 'general' }

// Listen for push messages
client.on('message', '/chat/general', ({ data }) => {
  console.log(`${data.from}: ${data.text}`)
})

// Fire-and-forget
client.send('message', '/chat/general', { from: 'Alice', text: 'Hello!' })
```

See the full [client documentation](./client) for details.

## What's Next?

- [Handlers](./handlers) — `@Message`, `@Connect`, `@Disconnect` decorators
- [Routing](./routing) — Event + path routing with parameters
- [Request Data](./request) — Resolver decorators for message data
- [Rooms & Broadcasting](./rooms) — Room management and message broadcasting
- [HTTP Integration](./integration) — Upgrade routes and shared HTTP context
- [Client](./client) — Full client API reference
- [Wire Protocol](./protocol) — JSON message format specification
- [Error Handling](./errors) — Error responses with `WsError`
- [Testing](./testing) — Unit-testing WebSocket handlers
