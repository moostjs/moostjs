# HTTP Adapter — @moostjs/event-http

Moost adapter over `@wooksjs/event-http`. For request data see [http-request.md](http-request.md); response control [http-response.md](http-response.md); auth [http-auth.md](http-auth.md).

- [Setup](#setup)
- [MoostHttp API](#moosthttp-api)
- [Route decorators](#route-decorators)
- [Path syntax](#path-syntax)
- [Handler returns](#handler-returns)
- [DI-exposed services](#di-exposed-services)
- [Local fetch / SSR](#local-fetch--ssr)
- [Re-exports](#re-exports)
- [Gotchas](#gotchas)

## Setup

```bash
npm create moost@latest [name] -- --http
# or
pnpm add @moostjs/event-http moost
```

Minimal server:

```ts
import { MoostHttp, Get } from '@moostjs/event-http'
import { Moost, Controller, Param } from 'moost'

@Controller()
class AppController {
  @Get('hello/:name')
  greet(@Param('name') name: string) { return `Hello, ${name}!` }
}

const app = new Moost()
app.adapter(new MoostHttp()).listen(3000)
app.registerControllers(AppController)
await app.init()
```

## MoostHttp API

```ts
new MoostHttp()                       // create a new WooksHttp
new MoostHttp(wooksHttpOptions)       // forwarded to createHttpApp
new MoostHttp(existingWooksHttp)      // reuse an instance
```

| Method | Returns | Notes |
|---|---|---|
| `listen(port?, ...)` | `Promise<void>` | Node `server.listen` overloads |
| `getHttpApp()` | `WooksHttp` | underlying engine |
| `getServerCb(onNoMatch?)` | `RequestListener` | for custom HTTP/HTTPS servers |
| `fetch(request)` | `Promise<Response \| null>` | in-process route invocation (SSR) |
| `request(input, init?)` | `Promise<Response \| null>` | convenience fetch; relative paths prefixed with `http://localhost` |

### Integrating with existing server

```ts
const http = new MoostHttp()
app.adapter(http)
createServer(tlsOptions, http.getServerCb()).listen(443)
await app.init()
```

## Route decorators

All from `@moostjs/event-http`. Underlying: `HttpMethod(method, path?)`.

| Decorator | HTTP method |
|---|---|
| `@Get(path?)` | GET |
| `@Post(path?)` | POST |
| `@Put(path?)` | PUT |
| `@Delete(path?)` | DELETE |
| `@Patch(path?)` | PATCH |
| `@All(path?)` | `*` (any) |
| `@HttpMethod(method, path?)` | e.g. `'HEAD'`, `'OPTIONS'` |
| `@Upgrade(path?)` | UPGRADE (for WebSocket handshake) |

Valid methods: `GET`, `PUT`, `POST`, `PATCH`, `DELETE`, `HEAD`, `OPTIONS`, `UPGRADE`, `*`.

### Path defaults

```ts
@Get()         // path = method name → GET /getUsers
@Get('')       // controller root    → GET /
@Get('list')   // explicit           → GET /list
```

### Route params

`@Param(name)` / `@Params()` are imported from **`moost`**, not from `@moostjs/event-http`.

```ts
@Get('users/:id')
find(@Param('id') id: string) {}

@Get(':type/:type/:id')
get(@Params() p: { type: string[]; id: string }) {}
```

## Path syntax

```ts
@Get('flights/:from/:to')                  // slash-separated
@Get('dates/:year-:month-:day')            // hyphen-separated
@Get('time/:hours(\\d{2})h:minutes(\\d{2})m')  // regex-constrained
@Get('rgb/:color/:color/:color')           // repeated param → array
@Get('*')                                  // wildcard
@Get('*.js')                               // wildcard with suffix
@Get('*/test/*')                           // multiple wildcards → array
@Get('*(\\d+)')                            // regex-constrained wildcard
```

### Controller prefix & nesting

```ts
@Controller('api/v1/users')
class UserController {
  @Get('')      // GET /api/v1/users
  @Get(':id')   // GET /api/v1/users/123
}

@Controller('api')
@ImportController('users', () => UserController)
@ImportController('products', () => ProductController)
class ApiController {}
```

## Handler returns

Whatever the handler returns becomes the response:

| Return | Content-Type |
|---|---|
| `string` | `text/plain` |
| object / array | `application/json` |
| `ReadableStream` | streamed |
| fetch `Response` | forwarded as-is |

Async works. Uncaught errors → HTTP 500 (JSON or HTML based on `Accept`).

## DI-exposed services

Attaching `MoostHttp` adds these to the DI container:

| Token | Type |
|---|---|
| `WooksHttp`, `'WooksHttp'` | underlying engine |
| `HttpServer` | `http.Server` |
| `HttpsServer` | `https.Server` |

```ts
@Injectable()
class MyService { constructor(private ws: WooksHttp) {} }
```

## Local fetch / SSR

`MoostHttp` supports in-process route invocation — no network round-trip.

```ts
await http.fetch(new Request('http://localhost/api/users'))   // Web Standard
await http.request('/api/users', { method: 'GET' })            // convenience
// returns null if no route matches
```

When called from within an HTTP context, `authorization` and `cookie` headers are auto-forwarded from the parent context.

### `enableLocalFetch(http)` — patch `globalThis.fetch`

Routes `/…` through MoostHttp; non-matching requests fall through to the original fetch.

```ts
const teardown = enableLocalFetch(http)
// fetch('/api/users') now goes through MoostHttp in-process
teardown()  // restore original fetch
```

## Re-exports

From `@moostjs/event-http`: `httpKind`, `HttpError`, `useHttpContext` (re-exported from `@wooksjs/event-http`).

## Gotchas

- `@Get()` (no arg) uses the **method name** as path. `@Get('')` is the controller root.
- `listen()` before `init()` is fine — adapter buffers.
- Route params are always strings; use pipes to coerce.
- Trailing `//` in a path forces a trailing slash in the URL.
- `@Param`/`@Params` come from `moost`, query/body/etc. come from `@moostjs/event-http`.
- Default 404 handler runs through the global interceptor chain.
