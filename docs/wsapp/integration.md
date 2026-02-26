# HTTP Integration

::: warning Experimental
This package is in an experimental phase. The API may change without following semver until it reaches a stable release.
:::

The recommended way to run WebSocket in production is HTTP-integrated mode, where the WS server shares the HTTP port. This gives you control over which paths accept WebSocket connections, enables authentication during the upgrade handshake, and keeps everything on a single port.

[[toc]]

## Setup

Pass the HTTP app instance when creating the WS adapter:

```ts
import { MoostHttp } from '@moostjs/event-http'
import { MoostWs } from '@moostjs/event-ws'
import { Moost } from 'moost'

const app = new Moost()
const http = new MoostHttp()
const ws = new MoostWs({ httpApp: http.getHttpApp() }) // [!code focus]

app.adapter(http)
app.adapter(ws)
app.registerControllers(/* ... */)

await http.listen(3000)
await app.init()
```

The `MoostWs` constructor accepts either a `WooksHttp` instance directly or any object with a `getHttpApp()` method (like `MoostHttp`).

## Upgrade Routes

In HTTP-integrated mode, WebSocket connections require an explicit upgrade route. Use the `@Upgrade` decorator from `@moostjs/event-http`:

```ts
import { Upgrade } from '@moostjs/event-http'
import type { WooksWs } from '@moostjs/event-ws'
import { Controller, Inject } from 'moost'

@Controller()
export class AppController {
  constructor(@Inject('WooksWs') private ws: WooksWs) {} // [!code focus]

  @Upgrade('ws') // [!code focus]
  upgrade() { // [!code focus]
    return this.ws.upgrade() // [!code focus]
  } // [!code focus]
}
```

Clients connect to `ws://localhost:3000/ws`. The `@Upgrade('ws')` route handles the HTTP 101 upgrade handshake, and `this.ws.upgrade()` completes the WebSocket connection.

::: tip DI with string keys
Use `@Inject('WooksWs')` (string key) rather than `@Inject(WooksWs)` (class reference) for the constructor parameter. This avoids module initialization order issues when running with tsx/esbuild, which doesn't emit `design:paramtypes` metadata.
:::

### Multiple Upgrade Paths

You can define multiple upgrade routes for different purposes:

```ts
@Controller()
export class AppController {
  constructor(@Inject('WooksWs') private ws: WooksWs) {}

  @Upgrade('ws')
  publicUpgrade() {
    return this.ws.upgrade()
  }

  @Upgrade('ws/admin')
  adminUpgrade() {
    // authenticate before upgrading
    const headers = useHeaders()
    if (headers.authorization !== 'Bearer admin-secret') {
      throw new WsError(401, 'Unauthorized')
    }
    return this.ws.upgrade()
  }
}
```

## Authentication

The upgrade route runs in a full HTTP context, so you can authenticate using HTTP headers, cookies, or query parameters before accepting the WebSocket connection:

### Header-Based Auth

```ts
import { Upgrade } from '@moostjs/event-http'
import type { WooksWs } from '@moostjs/event-ws'
import { WsError } from '@moostjs/event-ws'
import { useHeaders } from '@wooksjs/event-http'
import { Controller, Inject } from 'moost'

@Controller()
export class SecureController {
  constructor(@Inject('WooksWs') private ws: WooksWs) {}

  @Upgrade('ws/secure')
  secureUpgrade() {
    const headers = useHeaders()
    const token = headers.authorization

    if (!token || !verifyToken(token)) {
      throw new WsError(401, 'Invalid or missing token')
    }

    return this.ws.upgrade()
  }
}
```

### Cookie-Based Auth

```ts
import { useCookies } from '@wooksjs/event-http'

@Upgrade('ws/session')
sessionUpgrade() {
  const cookies = useCookies()
  const sessionId = cookies.get('session_id')

  if (!sessionId || !isValidSession(sessionId)) {
    throw new WsError(401, 'Invalid session')
  }

  return this.ws.upgrade()
}
```

### Using Moost Interceptors

You can also protect upgrade routes with standard Moost interceptors:

```ts
import { Upgrade } from '@moostjs/event-http'
import { Controller, Inject, Intercept } from 'moost'
import { AuthGuard } from './auth.guard'

@Controller()
export class SecureController {
  constructor(@Inject('WooksWs') private ws: WooksWs) {}

  @Upgrade('ws/protected')
  @Intercept(AuthGuard) // [!code focus]
  protectedUpgrade() {
    return this.ws.upgrade()
  }
}
```

## HTTP Context in WS Handlers

After the upgrade, WebSocket handlers can access the original HTTP upgrade request through the parent context chain:

```ts
import { Connect, ConnectionId } from '@moostjs/event-ws'
import { useHeaders, useRequest, useCookies } from '@wooksjs/event-http'

@Connect()
onConnect(@ConnectionId() id: string) {
  const { url } = useRequest()       // upgrade URL
  const headers = useHeaders()        // upgrade request headers
  const cookies = useCookies()        // cookies from upgrade request

  console.log('Upgrade URL:', url)
  console.log('User-Agent:', headers['user-agent'])
}
```

This works in all handler types (`@Connect`, `@Disconnect`, `@Message`) because the connection context carries a reference to the parent HTTP context.

## DI: Injecting Adapter Instances

The `MoostWs` adapter registers both class reference and string keys in the DI container:

| Key | Resolves To |
|-----|-------------|
| `MoostWs` / `'MoostWs'` | The `MoostWs` adapter instance |
| `WooksWs` / `'WooksWs'` | The underlying `WooksWs` instance |

Use string keys for reliability:

```ts
@Controller()
export class MyController {
  constructor(
    @Inject('MoostWs') private wsAdapter: MoostWs,
    @Inject('WooksWs') private wsApp: WooksWs,
  ) {}
}
```

## Mixing HTTP and WS Handlers

A single application can serve both HTTP and WebSocket handlers. Controllers are registered once, and each adapter picks up only the decorators it understands:

```ts
import { Get } from '@moostjs/event-http'
import { Message, MessageData } from '@moostjs/event-ws'
import { Controller } from 'moost'

@Controller('api')
export class ApiController {
  // HTTP handler — picked up by MoostHttp
  @Get('status')
  getStatus() {
    return { online: true }
  }

  // WS handler — picked up by MoostWs
  @Message('query', '/status')
  wsStatus() {
    return { online: true }
  }
}
```
