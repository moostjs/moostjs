# HTTP Request Data — @moostjs/event-http

Resolver decorators for incoming HTTP requests. Usable as **parameter** or **property** decorator (property form requires `@Injectable('FOR_EVENT')`) — except `@Query`, which is typed as a parameter decorator only. Setup/routing: [event-http.md](event-http.md).

- [Table](#table)
- [@Query](#query)
- [@Header / @Cookie](#header--cookie)
- [@Body / @RawBody](#body--rawbody)
- [@Authorization](#authorization)
- [@Url / @Method / @ReqId](#url--method--reqid)
- [@Req / @Res](#req--res)
- [@Ip / @IpList](#ip--iplist)
- [@Locale](#locale)
- [Gotchas](#gotchas)

## Table

| Decorator | Returns | Import |
|---|---|---|
| `@Param(name)` | route param | `moost` |
| `@Params()` | all route params | `moost` |
| `@Query(name?)` | query value / all | `@moostjs/event-http` |
| `@Header(name)` | header (name must be lowercase) | `@moostjs/event-http` |
| `@Cookie(name)` | cookie value | `@moostjs/event-http` |
| `@Body()` | parsed body (JSON/form/text) | `@moostjs/event-http` |
| `@RawBody()` | raw `Buffer` | `@moostjs/event-http` |
| `@Authorization(field)` | `'username'`/`'password'`/`'bearer'`/`'raw'`/`'type'` | `@moostjs/event-http` |
| `@Url()` | URL string | `@moostjs/event-http` |
| `@Method()` | HTTP method | `@moostjs/event-http` |
| `@ReqId()` | request UUID | `@moostjs/event-http` |
| `@Ip()` | client IP per the app-level `trustProxy` (`new MoostHttp({ trustProxy })`) | `@moostjs/event-http` |
| `@Locale()` | event locale (`useLocale().get()`; policy = `MoostHttp({ resolveLocale })`) | `moost` |
| `@IpList()` | `{ remoteIp: string; forwarded: string[] }` | `@moostjs/event-http` |
| `@Req()` | Node `IncomingMessage` | `@moostjs/event-http` |
| `@Res(opts?)` | Node `ServerResponse` | `@moostjs/event-http` |

## @Query

```ts
@Get('search')
search(
  @Query('q') q: string,                    // single
  @Query() all: Record<string, string | string[]>, // all ({} if no query present)
) {}
// GET /search?q=moost&limit=10 → q='moost', all={q:'moost',limit:'10'}
```

`paramSource`: `'QUERY_ITEM'` (named) or `'QUERY'` (all).

## @Header / @Cookie

```ts
@Header('content-type') ct: string
@Cookie('session') session: string
```

## @Body / @RawBody

```ts
@Post('users')
create(@Body() data: { name: string; email: string }) {}

@Post('upload')
upload(@RawBody() raw: Buffer) {}
```

`@Body()` uses `@wooksjs/http-body`, auto-detects JSON / form-encoded / text.

## @Authorization

```ts
@Authorization('bearer')   token: string      // full header incl. "Bearer " prefix; undefined unless scheme is bearer
@Authorization('type')     type: string       // "Bearer" / "Basic" / …
@Authorization('username') user: string       // Basic auth
@Authorization('password') pass: string       // Basic auth
@Authorization('raw')      creds: string      // credentials after scheme prefix
```

## @Url / @Method / @ReqId

```ts
@Url() url: string          // '/info?page=1'
@Method() method: string    // 'GET'
@ReqId() id: string         // UUID per request
```

## @Req / @Res

```ts
@Req() request: IncomingMessage
@Res() res: ServerResponse                          // framework does NOT process return
@Res({ passthrough: true }) res: ServerResponse     // framework still processes return
```

## @Ip / @IpList

```ts
@Ip() ip: string                                          // client IP per the app's trustProxy
@IpList() ips: { remoteIp: string; forwarded: string[] }  // RAW socket peer + x-forwarded-for chain (forgeable)

new MoostHttp({ trustProxy: 1 })                    // hops | IP/CIDR list (+ 'loopback'/'linklocal'/'uniquelocal') | (addr, hop) => boolean
new MoostHttp({ trustProxy: 1, proxyHeaders: 'forwarded' }) // RFC 7239 Forwarded instead of X-Forwarded-*
```

- Default: no proxy trusted → `@Ip()` = socket peer; forwarding headers ignored. With `trustProxy`: the right-most UNTRUSTED `X-Forwarded-For` hop. Same resolver drives `useRequest().protocol()` / `host()`.
- IPv4-mapped (`::ffff:10.0.0.5`) → plain IPv4. `''` = unknown client (in-process `fetch()` without a peer; malformed entry from a trusted proxy).
- `@Ip({ trustProxy: true })` is DEPRECATED: trusts exactly ONE hop (right-most entry). Up to and including `0.6.53` it took the LEFT-most entry — client-forgeable.

## @Locale

```ts
import { Locale } from 'moost'
new MoostHttp({ resolveLocale: () => useAcceptLanguage().negotiate(['en', 'de'], 'en') }) // lazy, once per request; adds Vary
@Get('x') x(@Locale() locale: string | undefined) {}
```

Kind-agnostic (`useLocale()` from `moost`; workflows / in-process fetch inherit the request's). Moost never translates — see [core.md](core.md#locale-and-translation) for `setTranslator()` / `useTranslate()`.

## Gotchas

1. `@Query('name')` → `undefined` when missing (not `null` / empty string); `@Query()` → `{}` when the query string is empty (up to and including `0.6.53`: `undefined`) — an all-optional query DTO validates without `@Optional()`.
2. `@Query()` values: keys ending in `[]` become `string[]` (`?tags[]=a&tags[]=b` → `{ 'tags[]': ['a','b'] }`); repeating a plain key (`?q=a&q=b`) throws an automatic 400 `Duplicate key`.
3. `@Header(name)` is an exact key lookup; Node lowercases incoming header names — `@Header('Content-Type')` returns `undefined`. Always pass lowercase names.
4. `@Res()` without `passthrough` suppresses handler-return processing entirely.
5. Query / param / header values arrive as strings (or string arrays) — coerce via pipes.
6. `@Param` / `@Params` are from `moost`, the rest from `@moostjs/event-http`.
7. Property-form resolvers require `@Injectable('FOR_EVENT')` (or a `FOR_EVENT` controller); `@Query` is parameter-only.
