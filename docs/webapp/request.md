# Reading Request Data

Moost provides **resolver decorators** that extract values from the incoming request and inject them into your handler parameters. Each decorator corresponds to a different part of the HTTP request.

## Route parameters

Covered in detail on the [Routing & Handlers](./routing) page:

```ts
@Get('users/:id')
getUser(
    @Param('id') id: string,       // single parameter
    @Params() all: { id: string }, // all parameters as object
) { /* ... */ }
```

## Query parameters

```ts
import { Get, Query } from '@moostjs/event-http'
import { Controller } from 'moost'

@Controller()
export class SearchController {
    @Get('search')
    search(
        @Query('q') query: string,               // single query param
        @Query() params: Record<string, string>, // all query params
    ) {
        return { query, params }
    }
}
```

```bash
curl "http://localhost:3000/search?q=moost&limit=10"
# { "query": "moost", "params": { "q": "moost", "limit": "10" } }
```

`@Query('name')` returns `undefined` if the parameter is missing. `@Query()` returns `undefined` (not an empty object) when there are no query parameters at all.

## Headers

```ts
import { Get, Header } from '@moostjs/event-http'
import { Controller } from 'moost'

@Controller()
export class ExampleController {
    @Get('test')
    test(@Header('content-type') contentType: string) {
        return { contentType }
    }
}
```

Header names are case-insensitive, matching standard HTTP behavior.

## Cookies

```ts
import { Get, Cookie } from '@moostjs/event-http'
import { Controller } from 'moost'

@Controller()
export class ExampleController {
    @Get('profile')
    profile(@Cookie('session') session: string) {
        return { session }
    }
}
```

## Request body

For `POST`, `PUT`, and `PATCH` requests, use `@Body()` to get the parsed body. Moost automatically detects JSON, form-encoded, and text content types.

```ts
import { Post, Body } from '@moostjs/event-http'
import { Controller } from 'moost'

@Controller('users')
export class UserController {
    @Post('')
    create(@Body() data: { name: string, email: string }) {
        return { created: data }
    }
}
```

For the raw body as a `Buffer`, use `@RawBody()`:

```ts
import { Post, RawBody } from '@moostjs/event-http'

@Post('upload')
upload(@RawBody() raw: Buffer) {
    // process raw bytes
}
```

## Authorization header

The `@Authorization` decorator extracts specific parts of the `Authorization` header:

```ts
import { Get, Authorization } from '@moostjs/event-http'

@Get('profile')
profile(
    @Authorization('bearer') token: string,    // Bearer token (without "Bearer " prefix)
    @Authorization('type') authType: string,   // "Bearer", "Basic", etc.
) { /* ... */ }

@Get('login')
login(
    @Authorization('username') user: string,   // from Basic auth
    @Authorization('password') pass: string,   // from Basic auth
    @Authorization('raw') credentials: string, // raw credentials string
) { /* ... */ }
```

::: tip
For production authentication, use the declarative [Authentication Guards](./auth) system instead of manually parsing the `Authorization` header.
:::

## URL and HTTP method

```ts
import { Get, Url, Method } from '@moostjs/event-http'

@Get('info')
info(
    @Url() url: string,       // e.g. "/info?page=1"
    @Method() method: string, // e.g. "GET"
) {
    return { url, method }
}
```

## Request ID

Every request gets a unique UUID, useful for logging and tracing:

```ts
import { Get, ReqId } from '@moostjs/event-http'

@Get('test')
test(@ReqId() requestId: string) {
    return { requestId } // e.g. "a1b2c3d4-..."
}
```

## IP address

```ts
import { Get, Ip, IpList } from '@moostjs/event-http'

@Get('client')
client(
    @Ip() ip: string,                          // direct client IP
    @Ip({ trustProxy: true }) realIp: string,  // considers x-forwarded-for
    @IpList() allIps: string[],                // full IP chain
) {
    return { ip, realIp, allIps }
}
```

## Raw Node.js request

When you need direct access to the underlying `IncomingMessage`:

```ts
import { Get, Req } from '@moostjs/event-http'
import type { IncomingMessage } from 'http'

@Get('raw')
raw(@Req() request: IncomingMessage) {
    return { httpVersion: request.httpVersion }
}
```

## Resolver decorators summary

| Decorator | Returns | Import from |
|---|---|---|
| `@Param(name)` | Route parameter value | `moost` |
| `@Params()` | All route params as object | `moost` |
| `@Query(name?)` | Query parameter(s) | `@moostjs/event-http` |
| `@Header(name)` | Request header value | `@moostjs/event-http` |
| `@Cookie(name)` | Cookie value | `@moostjs/event-http` |
| `@Body()` | Parsed request body | `@moostjs/event-http` |
| `@RawBody()` | Raw body as `Buffer` | `@moostjs/event-http` |
| `@Authorization(field)` | Auth header field | `@moostjs/event-http` |
| `@Url()` | Requested URL | `@moostjs/event-http` |
| `@Method()` | HTTP method string | `@moostjs/event-http` |
| `@ReqId()` | Request UUID | `@moostjs/event-http` |
| `@Ip(opts?)` | Client IP address | `@moostjs/event-http` |
| `@IpList()` | All IP addresses | `@moostjs/event-http` |
| `@Req()` | Raw `IncomingMessage` | `@moostjs/event-http` |

All resolver decorators can also be used as **property decorators** on `FOR_EVENT`-scoped controllers. See [Dependency Injection](./di) for details.
