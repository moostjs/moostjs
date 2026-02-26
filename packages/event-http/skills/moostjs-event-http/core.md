# Core concepts & setup — @moostjs/event-http

> How to create and configure an HTTP server with the Moost HTTP adapter.

## Concepts

`@moostjs/event-http` is the HTTP adapter for the Moost framework. It bridges Moost's decorator-driven controller system with `@wooksjs/event-http` (the underlying HTTP engine). The adapter handles:

- Binding decorated handler methods to HTTP routes
- Managing request scoping and cleanup
- Providing dependency injection for the underlying WooksHttp instance

**Key classes:**
- `MoostHttp` — the adapter class you instantiate and attach to your Moost app
- `WooksHttp` — the underlying Wooks HTTP engine (available via DI if needed)

## Installation

```bash
npm install @moostjs/event-http moost
# or
pnpm add @moostjs/event-http moost
```

Peer dependencies (installed automatically with moost):
- `@wooksjs/event-core` — async event context
- `@prostojs/infact` — dependency injection
- `@prostojs/router` — route matching

## Setup

### Minimal HTTP server

```ts
import { MoostHttp, Get } from '@moostjs/event-http'
import { Moost, Controller, Param } from 'moost'

@Controller()
class AppController {
  @Get('hello/:name')
  greet(@Param('name') name: string) {
    return `Hello, ${name}!`
  }
}

const app = new Moost()
void app.adapter(new MoostHttp()).listen(3000, () => {
  app.getLogger('app').info('Up on port 3000')
})
void app.registerControllers(AppController).init()
```

### Scaffold a project

```bash
npm create moost -- --http
# or with a name:
npm create moost my-web-app -- --http
```

## API Reference

### `MoostHttp`

The HTTP adapter class implementing `TMoostAdapter`.

```ts
import { MoostHttp } from '@moostjs/event-http'

// Default — creates a new WooksHttp internally
const http = new MoostHttp()

// With options passed to WooksHttp
const http = new MoostHttp({ onNotFound: customHandler })

// With an existing WooksHttp instance
const http = new MoostHttp(existingWooksHttp)
```

**Methods:**

| Method | Returns | Description |
|--------|---------|-------------|
| `listen(port?, ...)` | `Promise<void>` | Start the HTTP server (same overloads as `net.Server.listen`) |
| `getHttpApp()` | `WooksHttp` | Access the underlying Wooks HTTP engine |
| `getServerCb()` | `RequestListener` | Get the request handler callback for use with existing Node.js servers |

### `getServerCb()` — Custom server integration

Use `getServerCb()` to integrate with an existing Node.js HTTP/HTTPS server:

```ts
import { createServer } from 'https'
import { MoostHttp } from '@moostjs/event-http'
import { Moost } from 'moost'

const http = new MoostHttp()
const app = new Moost()
app.adapter(http)

const server = createServer(tlsOptions, http.getServerCb())
server.listen(443)
await app.init()
```

### `HttpError`

Re-exported from `@wooksjs/event-http`. Throw to produce an HTTP error response with a specific status code.

```ts
import { HttpError } from '@moostjs/event-http'

throw new HttpError(404, 'Not Found')
throw new HttpError(422, { message: 'Validation failed', errors: [...] })
```

### `httpKind`

Re-exported from `@wooksjs/event-http`. The event kind identifier for HTTP events.

### `useHttpContext()`

Re-exported from `@wooksjs/event-http`. Access the raw Wooks HTTP context from within a handler (advanced use only — prefer decorators).

## Common Patterns

### Pattern: Class extending Moost

Instead of creating a separate `Moost` instance and registering controllers, extend `Moost` directly:

```ts
import { MoostHttp, Get } from '@moostjs/event-http'
import { Moost, Param } from 'moost'

class MyServer extends Moost {
  @Get('test/:name')
  test(@Param('name') name: string) {
    return { message: `Hello ${name}!` }
  }
}

const app = new MyServer()
app.adapter(new MoostHttp()).listen(3000)
void app.init()
```

### Pattern: Multiple controllers

```ts
import { Moost } from 'moost'
import { MoostHttp } from '@moostjs/event-http'

const app = new Moost()
app.adapter(new MoostHttp()).listen(3000)
void app
  .registerControllers(UserController, ProductController, OrderController)
  .init()
```

## DI-available services

When MoostHttp is attached, these are available via constructor injection:

| Token | Type | Description |
|-------|------|-------------|
| `WooksHttp` | class | The underlying Wooks HTTP app |
| `'WooksHttp'` | string | Same, by string token |
| `HttpServer` | `http.Server` | The Node.js HTTP server instance |
| `HttpsServer` | `https.Server` | The Node.js HTTPS server instance |

```ts
import { Injectable } from 'moost'
import { WooksHttp } from '@wooksjs/event-http'

@Injectable()
class MyService {
  constructor(private wooks: WooksHttp) {}
}
```

## Best Practices

- Call `app.adapter(http).listen(port)` before `app.init()` — the adapter must be attached before initialization
- Use `registerControllers()` to add controller classes, not instances
- Prefer the decorator-based API (`@Get`, `@Body`, etc.) over accessing wooks composables directly
- Use `getServerCb()` when integrating with existing HTTP/HTTPS servers instead of calling `listen()`

## Gotchas

- The `path` argument in route decorators is optional — when omitted, the method name is used as the path segment
- `@Get('')` (empty string) maps to the controller root, while `@Get()` (no argument) uses the method name
- `app.init()` must be called after `registerControllers()` — routes are bound during initialization
- MoostHttp registers a default 404 handler that runs through the global interceptor chain
