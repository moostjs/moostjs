# HTTP Adapter — @moostjs/event-http

Bridge Moost's decorator-driven controller system with `@wooksjs/event-http` for HTTP servers.

For request data, see [http-request.md]. For response control, see [http-response.md]. For authentication, see [http-auth.md].

## Setup

### Scaffold a project

```bash
npm create moost@latest -- --http
# or with a name:
npm create moost my-web-app -- --http
```

### Installation

```bash
npm install @moostjs/event-http moost
# or
pnpm add @moostjs/event-http moost
```

Peer dependencies (installed automatically with moost):
- `@wooksjs/event-core` — async event context
- `@prostojs/infact` — dependency injection
- `@prostojs/router` — route matching

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

### MoostHttp constructor

```ts
import { MoostHttp } from '@moostjs/event-http'

// Default — create a new WooksHttp internally
const http = new MoostHttp()

// With options passed to WooksHttp
const http = new MoostHttp({ /* WooksHttp options */ })

// With an existing WooksHttp instance
const http = new MoostHttp(existingWooksHttp)
```

### MoostHttp methods

| Method | Returns | Description |
|--------|---------|-------------|
| `listen(port?, ...)` | `Promise<void>` | Start the HTTP server (same overloads as `net.Server.listen`) |
| `getHttpApp()` | `WooksHttp` | Access the underlying Wooks HTTP engine |
| `getServerCb(onNoMatch?)` | `RequestListener` | Get the request handler callback for use with existing Node.js servers |

### `getServerCb()` — HTTPS / custom server

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

## HttpError

Re-exported from `@wooksjs/event-http`. Throw to produce an HTTP error response with a specific status code.

```ts
import { HttpError } from '@moostjs/event-http'

throw new HttpError(404, 'Not Found')
throw new HttpError(422, { message: 'Validation failed', errors: [...] })
```

Uncaught exceptions become HTTP 500 responses. The response format (JSON or HTML) adapts based on the `Accept` header.

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

## Route decorators

### HTTP method decorators

All imported from `@moostjs/event-http`:

| Decorator | HTTP Method | Usage |
|-----------|-------------|-------|
| `@Get(path?)` | GET | `@Get('users/:id')` |
| `@Post(path?)` | POST | `@Post('users')` |
| `@Put(path?)` | PUT | `@Put('users/:id')` |
| `@Delete(path?)` | DELETE | `@Delete('users/:id')` |
| `@Patch(path?)` | PATCH | `@Patch('users/:id')` |
| `@All(path?)` | All methods | `@All('proxy/*')` |
| `@HttpMethod(method, path?)` | Any method | `@HttpMethod('OPTIONS', '')` |
| `@Upgrade(path?)` | UPGRADE | `@Upgrade('/ws')` |

```ts
import { Get, Post, Put, Delete, Patch, All, HttpMethod, Upgrade } from '@moostjs/event-http'
```

### `@HttpMethod(method, path?)`

The base decorator. All convenience decorators (`@Get`, `@Post`, etc.) call this internally.

```ts
@HttpMethod('HEAD', 'health')
healthCheck() { /* HEAD /health */ }

@HttpMethod('OPTIONS', '')
cors() { /* OPTIONS / */ }
```

Valid methods: `'GET'`, `'PUT'`, `'POST'`, `'PATCH'`, `'DELETE'`, `'HEAD'`, `'OPTIONS'`, `'UPGRADE'`, `'*'`

### `@Upgrade(path?)`

Register an UPGRADE route for WebSocket handshakes:

```ts
@Upgrade('/ws')
handleUpgrade(ws: WooksWs) {
  return ws.upgrade()
}
```

### Route parameters — `@Param` and `@Params`

Imported from `moost` (not from `@moostjs/event-http`):

```ts
import { Controller, Param, Params } from 'moost'
import { Get } from '@moostjs/event-http'

@Controller('users')
class UserController {
  @Get(':id')
  find(@Param('id') id: string) {
    return { id } // GET /users/123
  }

  @Get(':type/:type/:id')
  getAsset(@Params() params: { type: string[], id: string }) {
    return params
  }
}
```

### Path defaults

```ts
@Get()         // path = method name, e.g. GET /getUsers
getUsers() {}

@Get('')       // path = controller root, e.g. GET /
root() {}

@Get('list')   // explicit path, e.g. GET /list
listItems() {}
```

### Multiple parameters

```ts
// Slash-separated: /flights/SFO/LAX
@Get('flights/:from/:to')
getFlight(@Param('from') from: string, @Param('to') to: string) {}

// Hyphen-separated: /dates/2024-01-15
@Get('dates/:year-:month-:day')
getDate(
  @Param('year') year: string,
  @Param('month') month: string,
  @Param('day') day: string,
) {}
```

### Regex-constrained parameters

```ts
// Only matches two-digit hours and minutes: /time/09h30m
@Get('time/:hours(\\d{2})h:minutes(\\d{2})m')
getTime(@Param('hours') hours: string, @Param('minutes') minutes: string) {}
```

### Repeated parameters (arrays)

```ts
// /rgb/255/128/0 -> color = ['255', '128', '0']
@Get('rgb/:color/:color/:color')
getRgb(@Param('color') color: string[]) {}
```

### Wildcards

```ts
@Controller('static')
class StaticController {
  @Get('*')
  handleAll(@Param('*') path: string) {}

  @Get('*.js')
  handleJS(@Param('*') name: string) {}

  // Multiple wildcards -> array
  @Get('*/test/*')
  handleTest(@Param('*') paths: string[]) {}

  // Regex on wildcard: only digits
  @Get('*(\\d+)')
  handleNumbers(@Param('*') path: string) {}
}
```

### Controller prefix

```ts
import { Controller } from 'moost'

@Controller('api/v1/users')
class UserController {
  @Get('')     // GET /api/v1/users
  list() {}

  @Get(':id')  // GET /api/v1/users/123
  find() {}
}
```

### Nested controllers

```ts
import { Controller, ImportController } from 'moost'

@Controller('api')
@ImportController('users', () => UserController)
@ImportController('products', () => ProductController)
class ApiController {}
// Routes: GET /api/users/..., GET /api/products/...
```

## Handler return values

Whatever the handler returns becomes the response body:

| Return type | Content-Type |
|-------------|--------------|
| `string` | `text/plain` |
| object / array | `application/json` |
| `ReadableStream` | streamed |
| fetch `Response` | forwarded as-is |

```ts
@Get('text')
getText() { return 'Hello!' }           // text/plain

@Get('json')
getJson() { return { message: 'Hi' } }  // application/json

@Get('data')
async getData() { return await fetchFromDb() }  // async works
```

## Common patterns

### Class extending Moost

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

### Multiple controllers

```ts
import { Moost } from 'moost'
import { MoostHttp } from '@moostjs/event-http'

const app = new Moost()
app.adapter(new MoostHttp()).listen(3000)
void app
  .registerControllers(UserController, ProductController, OrderController)
  .init()
```

## Programmatic Fetch (SSR)

`MoostHttp` supports in-process route invocation for SSR scenarios — call your own API routes without a network round-trip.

```ts
import { MoostHttp, enableLocalFetch } from '@moostjs/event-http'

const http = new MoostHttp()

// Direct invocation via Web Standard Request/Response
const response = await http.fetch(new Request('http://localhost/api/users'))
// Convenience wrapper (relative paths auto-prefixed with http://localhost)
const response = await http.request('/api/users', { method: 'GET' })
// Returns null if no route matches
```

When called from within an existing HTTP context (e.g., during SSR rendering), `authorization` and `cookie` headers are automatically forwarded from the parent context.

### enableLocalFetch(http)

Patches `globalThis.fetch` so that requests to local paths (`/...`) are routed through MoostHttp in-process. Non-matching requests fall through to the original `fetch`.

```ts
const teardown = enableLocalFetch(http)
// Now: fetch('/api/users') goes through MoostHttp in-process
// Later: teardown() restores the original globalThis.fetch
```

## Re-exports

- `httpKind` — event kind identifier for HTTP events (from `@wooksjs/event-http`)
- `useHttpContext()` — access the raw Wooks HTTP context from within a handler (advanced; prefer decorators)

## Best practices

- Call `app.adapter(http).listen(port)` before `app.init()` — the adapter must be attached before initialization
- Use `registerControllers()` to add controller classes, not instances
- Prefer the decorator-based API (`@Get`, `@Body`, etc.) over accessing wooks composables directly
- Use `getServerCb()` when integrating with existing HTTP/HTTPS servers instead of calling `listen()`
- Use `@Get('')` (empty string) for the controller root path, not `@Get()` (which uses the method name)
- Keep controller prefixes as REST resource names: `@Controller('users')`, `@Controller('products')`
- Use `@Param` for individual route parameters, `@Params` when you need the full params object
- Prefer convenience decorators (`@Get`, `@Post`) over `@HttpMethod` for standard methods

## Gotchas

- `@Get()` without arguments uses the **method name** as the path — this is rarely what you want
- `@Get('')` (empty string) maps to the controller root, while `@Get()` (no argument) uses the method name
- `app.init()` must be called after `registerControllers()` — routes are bound during initialization
- MoostHttp registers a default 404 handler that runs through the global interceptor chain
- Route parameters are always strings — use pipes to transform to numbers/booleans
- An explicit double slash `//` at the end of a path forces the URL to end with a trailing slash
- Query parameters are not part of the route path — use `@Query()` to extract them (see [http-request.md])
- `@Param` and `@Params` are imported from `moost`, not from `@moostjs/event-http`
