# Core concepts & setup — @moostjs/event-ws

> Installation, mental model, standalone vs HTTP-integrated modes, and adapter configuration.

## Concepts

`@moostjs/event-ws` is a Moost adapter for WebSocket events. It wraps `@wooksjs/event-ws` and adds decorator-based routing, dependency injection, interceptors, and pipes to WebSocket handlers.

**Two modes:**
- **Standalone** — dedicated WebSocket server, no HTTP. Use `WsApp` for quick setup or `MoostWs` with `listen()`.
- **HTTP-integrated** (recommended for production) — shares the HTTP port, requires explicit `@Upgrade()` route from `@moostjs/event-http`.

**Wire protocol:** JSON-over-WebSocket with `event` + `path` routing. Clients send `{ event, path, data?, id? }`. Server replies with `{ id, data?, error? }` or pushes `{ event, path, data? }`.

## Installation

```bash
npm install @moostjs/event-ws
```

For HTTP-integrated mode, also install:
```bash
npm install @moostjs/event-ws @moostjs/event-http
```

## Standalone Mode — WsApp

`WsApp` extends `Moost` and sets up a standalone `MoostWs` adapter automatically:

```ts
import { WsApp, Message, MessageData, Connect, ConnectionId } from '@moostjs/event-ws'
import { Controller } from 'moost'

@Controller()
class ChatController {
  @Connect()
  onConnect(@ConnectionId() id: string) {
    console.log(`Connected: ${id}`)
  }

  @Message('echo', '/echo')
  echo(@MessageData() data: unknown) {
    return data
  }
}

new WsApp()
  .controllers(ChatController)
  .start(3000)
```

### WsApp API

```ts
class WsApp extends Moost {
  controllers(...controllers: (object | Function | [string, object | Function])[]): this
  useWsOptions(opts: { ws?: TWooksWsOptions }): this
  getWsAdapter(): MoostWs | undefined
  start(port: number, hostname?: string): Promise<void>
}
```

## HTTP-Integrated Mode — MoostWs

Pass the HTTP app to share the port. Requires an `@Upgrade()` route:

```ts
import { MoostHttp } from '@moostjs/event-http'
import { MoostWs } from '@moostjs/event-ws'
import { Moost } from 'moost'

const app = new Moost()
const http = new MoostHttp()
const ws = new MoostWs({ httpApp: http.getHttpApp() })

app.adapter(http)
app.adapter(ws)
app.registerControllers(AppController, ChatController)

await http.listen(3000)
await app.init()
```

The upgrade controller:

```ts
import { Upgrade } from '@moostjs/event-http'
import type { WooksWs } from '@moostjs/event-ws'
import { Controller, Inject } from 'moost'

@Controller()
export class AppController {
  constructor(@Inject('WooksWs') private ws: WooksWs) {}

  @Upgrade('ws')
  upgrade() {
    return this.ws.upgrade()
  }
}
```

### MoostWs API

```ts
interface TMoostWsOpts {
  wooksWs?: WooksWs | TWooksWsOptions
}

class MoostWs {
  constructor(opts?: TMoostWsOpts & { httpApp?: { getHttpApp(): unknown } | object })
  getWsApp(): WooksWs
  listen(port: number, hostname?: string): Promise<void>  // standalone only
  close(): void
}
```

### TWooksWsOptions

```ts
interface TWooksWsOptions {
  heartbeatInterval?: number       // ping interval ms (default: 30000, 0 = disabled)
  heartbeatTimeout?: number        // pong timeout ms (default: 5000)
  messageParser?: (raw: Buffer | string) => WsClientMessage
  messageSerializer?: (msg: WsReplyMessage | WsPushMessage) => string | Buffer
  logger?: TConsoleBase
  maxMessageSize?: number          // bytes (default: 1MB)
  wsServerAdapter?: WsServerAdapter
  broadcastTransport?: WsBroadcastTransport
}
```

## DI: Injecting Adapter Instances

The adapter registers both class and string keys:

| Key | Resolves To |
|-----|-------------|
| `MoostWs` / `'MoostWs'` | The `MoostWs` adapter instance |
| `WooksWs` / `'WooksWs'` | The underlying `WooksWs` instance |

Use string keys for reliability (avoids esbuild/tsx metadata issues):

```ts
constructor(@Inject('WooksWs') private ws: WooksWs) {}
```

## Best Practices

- Use HTTP-integrated mode for production — single port, explicit upgrade control, easier auth
- Use `WsApp` for quick prototyping or standalone WebSocket services
- Use `@Inject('WooksWs')` (string key) rather than class reference to avoid module init order issues

## Gotchas

- `WsApp.start()` must be awaited — it calls `this.init()` and `listen()` internally
- In HTTP-integrated mode, `ws.listen()` is NOT called — the HTTP server handles the port
- The package is marked experimental — the API may change without semver until stable
