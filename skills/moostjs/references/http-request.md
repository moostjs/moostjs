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
| `@Ip(opts?)` | client IP (`{ trustProxy }` for `x-forwarded-for`) | `@moostjs/event-http` |
| `@IpList()` | `{ remoteIp: string; forwarded: string[] }` | `@moostjs/event-http` |
| `@Req()` | Node `IncomingMessage` | `@moostjs/event-http` |
| `@Res(opts?)` | Node `ServerResponse` | `@moostjs/event-http` |

## @Query

```ts
@Get('search')
search(
  @Query('q') q: string,                    // single
  @Query() all: Record<string, string | string[]>, // all (undefined if no query present)
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
@Ip() ip: string
@Ip({ trustProxy: true }) realIp: string   // considers x-forwarded-for
@IpList() ips: { remoteIp: string; forwarded: string[] }  // remote IP + x-forwarded-for chain
```

## Gotchas

1. `@Query('name')` → `undefined` when missing (not `null` / empty string); `@Query()` → `undefined` (not `{}`) when the query string is empty.
2. `@Query()` values: keys ending in `[]` become `string[]` (`?tags[]=a&tags[]=b` → `{ 'tags[]': ['a','b'] }`); repeating a plain key (`?q=a&q=b`) throws an automatic 400 `Duplicate key`.
3. `@Header(name)` is an exact key lookup; Node lowercases incoming header names — `@Header('Content-Type')` returns `undefined`. Always pass lowercase names.
4. `@Res()` without `passthrough` suppresses handler-return processing entirely.
5. Query / param / header values arrive as strings (or string arrays) — coerce via pipes.
6. `@Param` / `@Params` are from `moost`, the rest from `@moostjs/event-http`.
7. Property-form resolvers require `@Injectable('FOR_EVENT')` (or a `FOR_EVENT` controller); `@Query` is parameter-only.
