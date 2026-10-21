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

`@Query('name')` returns `undefined` if the parameter is missing. `@Query()` returns an empty object `{}` when there are no query parameters at all, so a query DTO with only optional fields validates as is, and a missing required field is reported per field. (Up to and including `0.6.53` it returned `undefined`.)

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

Pass the header name in **lowercase** — Node.js normalizes incoming header names to lowercase, and the lookup is an exact key match. `@Header('Content-Type')` returns `undefined`.

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
    @Authorization('bearer') token: string,    // full Authorization header incl. "Bearer " prefix (undefined unless scheme is bearer)
    @Authorization('type') authType: string,   // "Bearer", "Basic", etc.
) { /* ... */ }

@Get('login')
login(
    @Authorization('username') user: string,   // from Basic auth
    @Authorization('password') pass: string,   // from Basic auth
    @Authorization('raw') credentials: string, // credentials with the scheme prefix stripped
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
    @Ip() ip: string,                          // client IP, per the app's trustProxy setting
    @IpList() ips: { remoteIp: string, forwarded: string[] }, // raw: socket peer + x-forwarded-for chain
) {
    return { ip, ips }
}
```

`@Ip()` follows the app-level `trustProxy` option. By default no proxy is trusted and `@Ip()` is the socket peer — forwarding headers are ignored, because any client can send them. Behind a reverse proxy or load balancer, tell the HTTP adapter what to trust:

```ts
import { MoostHttp } from '@moostjs/event-http'

const http = new MoostHttp({
    trustProxy: 1,            // one proxy in front (Caddy, nginx, a cloud load balancer)
    // trustProxy: ['loopback', '10.0.0.0/8'],   // or: the proxies' addresses / CIDRs
    // trustProxy: (addr, hop) => hop < 2,        // or: a predicate
    // proxyHeaders: 'forwarded',                 // read RFC 7239 `Forwarded` instead of X-Forwarded-*
})
```

The client is the right-most `X-Forwarded-For` hop that is not trusted. The same setting drives `useRequest().protocol()` and `host()` (`X-Forwarded-Proto` / `X-Forwarded-Host`). IPv4-mapped addresses (`::ffff:10.0.0.5`) are returned as plain IPv4, and `@Ip()` is `''` when the client is unknown (an in-process [fetch](./fetch) without a peer, or a malformed entry written by a trusted proxy). `@IpList()` returns the raw, unvalidated values — never use it for access decisions.

::: warning Deprecated: `@Ip({ trustProxy: true })`
The per-decorator option now trusts exactly **one** proxy hop (the right-most `X-Forwarded-For` entry). Up to and including `0.6.53` it took the left-most entry, which any client can forge. Configure `trustProxy` on `MoostHttp` and use `@Ip()` instead.
:::

## Locale

`@Locale()` (from `moost`) resolves the locale of the current event — `useLocale().get()`, or `undefined` when nothing set one. Moost only carries the locale; your app decides how it is chosen, and translates with its own i18n library (see [Translating text](/moost/i18n)):

```ts
import { Locale } from 'moost'
import { Get, MoostHttp, useAcceptLanguage } from '@moostjs/event-http'

const http = new MoostHttp({
    // your policy: e.g. ?lang, a cookie or the user profile first, then Accept-Language
    resolveLocale: () => useAcceptLanguage().negotiate(['en', 'de', 'fr'], 'en'),
})

@Get('greeting')
greeting(@Locale() locale: string) {
    return locale === 'de' ? 'Hallo' : 'Hello'
}
```

`resolveLocale` runs lazily, on the first read in a request. `useAcceptLanguage().negotiate()` adds `Vary: Accept-Language` to the response. A workflow or an in-process `fetch()` started from the request reads the request's locale.

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
| `@Ip()` | Client IP address (per the app's `trustProxy`) | `@moostjs/event-http` |
| `@Locale()` | Locale of the event (`useLocale().get()`) | `moost` |
| `@IpList()` | `{ remoteIp, forwarded }` IP object | `@moostjs/event-http` |
| `@Req()` | Raw `IncomingMessage` | `@moostjs/event-http` |

All resolver decorators can also be used as **property decorators** on `FOR_EVENT`-scoped controllers. See [Dependency Injection](./di) for details.
