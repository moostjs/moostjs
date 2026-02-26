# Request data — @moostjs/event-http

> Extracting data from incoming HTTP requests using resolver decorators.

## Concepts

Moost provides **resolver decorators** that extract values from the incoming request and inject them as handler method parameters. Each decorator wraps a `@Resolve()` call that invokes the appropriate `@wooksjs/event-http` composable. All resolver decorators can also be used as **property decorators** on `FOR_EVENT`-scoped controllers.

## API Reference

### `@Query(name?)`

Extract query parameters. With a name, returns a single value; without, returns all as an object.

```ts
import { Get, Query } from '@moostjs/event-http'

@Get('search')
search(
  @Query('q') query: string,                // single param
  @Query() params: Record<string, string>,   // all params
) {}
// GET /search?q=moost&limit=10
// query = 'moost', params = { q: 'moost', limit: '10' }
```

- Returns `undefined` if the parameter is missing
- `@Query()` returns `undefined` (not `{}`) when there are no query params at all
- Sets metadata: `paramSource: 'QUERY_ITEM'` (named) or `'QUERY'` (all)

### `@Header(name)`

Extract a request header value.

```ts
import { Get, Header } from '@moostjs/event-http'

@Get('test')
test(@Header('content-type') contentType: string) {}
```

Header names are case-insensitive.

### `@Cookie(name)`

Extract a request cookie value.

```ts
import { Get, Cookie } from '@moostjs/event-http'

@Get('profile')
profile(@Cookie('session') session: string) {}
```

### `@Body()`

Parse and return the request body. Automatically detects JSON, form-encoded, and text content types.

```ts
import { Post, Body } from '@moostjs/event-http'

@Post('users')
create(@Body() data: { name: string, email: string }) {}
```

- Sets metadata: `paramSource: 'BODY'`
- Uses `@wooksjs/http-body` for parsing

### `@RawBody()`

Get the raw request body as a `Buffer`.

```ts
import { Post, RawBody } from '@moostjs/event-http'

@Post('upload')
upload(@RawBody() raw: Buffer) {}
```

### `@Authorization(field)`

Extract parts of the `Authorization` header.

```ts
import { Get, Authorization } from '@moostjs/event-http'

@Get('profile')
profile(
  @Authorization('bearer') token: string,      // Bearer token (no prefix)
  @Authorization('type') authType: string,     // "Bearer", "Basic", etc.
  @Authorization('username') user: string,     // from Basic auth
  @Authorization('password') pass: string,     // from Basic auth
  @Authorization('raw') credentials: string,   // raw credentials string
) {}
```

Valid fields: `'username'`, `'password'`, `'bearer'`, `'raw'`, `'type'`

### `@Url()`

Get the requested URL string.

```ts
import { Get, Url } from '@moostjs/event-http'

@Get('info')
info(@Url() url: string) {}
// url = '/info?page=1'
```

### `@Method()`

Get the HTTP method string.

```ts
import { All, Method } from '@moostjs/event-http'

@All('proxy')
proxy(@Method() method: string) {}
// method = 'GET', 'POST', etc.
```

### `@Req()`

Get the raw Node.js `IncomingMessage`.

```ts
import { Get, Req } from '@moostjs/event-http'
import type { IncomingMessage } from 'http'

@Get('raw')
raw(@Req() request: IncomingMessage) {
  return { httpVersion: request.httpVersion }
}
```

### `@Res(opts?)`

Get the raw Node.js `ServerResponse`. When used, the framework does **not** process the return value.

```ts
import { Get, Res } from '@moostjs/event-http'
import type { ServerResponse } from 'http'

@Get('raw')
raw(@Res() res: ServerResponse) {
  res.writeHead(200, { 'content-type': 'text/plain' })
  res.end('Manual response')
}
```

Pass `{ passthrough: true }` to get the raw response but still let the framework handle the return value:

```ts
@Get('hybrid')
hybrid(@Res({ passthrough: true }) res: ServerResponse) {
  res.setHeader('x-custom', 'value')
  return { data: 'processed by framework' }
}
```

### `@ReqId()`

Get the unique request UUID.

```ts
import { Get, ReqId } from '@moostjs/event-http'

@Get('test')
test(@ReqId() requestId: string) {}
```

### `@Ip(opts?)`

Get the client IP address.

```ts
import { Get, Ip } from '@moostjs/event-http'

@Get('client')
client(
  @Ip() ip: string,                          // direct client IP
  @Ip({ trustProxy: true }) realIp: string,  // considers x-forwarded-for
) {}
```

### `@IpList()`

Get the full IP address chain.

```ts
import { Get, IpList } from '@moostjs/event-http'

@Get('client')
client(@IpList() allIps: string[]) {}
```

## Decorator summary table

| Decorator | Returns | Import |
|-----------|---------|--------|
| `@Param(name)` | Route parameter | `moost` |
| `@Params()` | All route params | `moost` |
| `@Query(name?)` | Query param(s) | `@moostjs/event-http` |
| `@Header(name)` | Header value | `@moostjs/event-http` |
| `@Cookie(name)` | Cookie value | `@moostjs/event-http` |
| `@Body()` | Parsed body | `@moostjs/event-http` |
| `@RawBody()` | Raw Buffer | `@moostjs/event-http` |
| `@Authorization(field)` | Auth field | `@moostjs/event-http` |
| `@Url()` | URL string | `@moostjs/event-http` |
| `@Method()` | HTTP method | `@moostjs/event-http` |
| `@ReqId()` | Request UUID | `@moostjs/event-http` |
| `@Ip(opts?)` | Client IP | `@moostjs/event-http` |
| `@IpList()` | IP chain | `@moostjs/event-http` |
| `@Req()` | IncomingMessage | `@moostjs/event-http` |
| `@Res(opts?)` | ServerResponse | `@moostjs/event-http` |

## Best Practices

- Use `@Authorization()` for quick header parsing; use `@Authenticate()` guards for production auth
- Prefer `@Body()` over `@RawBody()` unless you need the raw bytes
- Query values are always strings — use pipes to transform to numbers or other types
- Use `@Ip({ trustProxy: true })` behind reverse proxies to get the real client IP

## Gotchas

- `@Query('name')` returns `undefined` when the parameter is missing (not `null` or empty string)
- `@Query()` (all params) returns `undefined` when there are no query params, not an empty object
- `@Res()` without `passthrough` takes over the response — the handler's return value is ignored
- `@Param` and `@Params` are imported from `moost`, not from `@moostjs/event-http`
