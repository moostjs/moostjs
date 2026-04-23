# HTTP Request Data — @moostjs/event-http

Resolver decorators for incoming HTTP requests. All usable as **parameter** or **property** decorator (property form requires `@Injectable('FOR_EVENT')`). Setup/routing: [event-http.md](event-http.md).

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
| `@Header(name)` | header (case-insensitive) | `@moostjs/event-http` |
| `@Cookie(name)` | cookie value | `@moostjs/event-http` |
| `@Body()` | parsed body (JSON/form/text) | `@moostjs/event-http` |
| `@RawBody()` | raw `Buffer` | `@moostjs/event-http` |
| `@Authorization(field)` | `'username'`/`'password'`/`'bearer'`/`'raw'`/`'type'` | `@moostjs/event-http` |
| `@Url()` | URL string | `@moostjs/event-http` |
| `@Method()` | HTTP method | `@moostjs/event-http` |
| `@ReqId()` | request UUID | `@moostjs/event-http` |
| `@Ip(opts?)` | client IP (`{ trustProxy }` for `x-forwarded-for`) | `@moostjs/event-http` |
| `@IpList()` | full IP chain | `@moostjs/event-http` |
| `@Req()` | Node `IncomingMessage` | `@moostjs/event-http` |
| `@Res(opts?)` | Node `ServerResponse` | `@moostjs/event-http` |

## @Query

```ts
@Get('search')
search(
  @Query('q') q: string,                    // single
  @Query() all: Record<string,string>,      // all (undefined if no query present)
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
@Authorization('bearer')   token: string      // raw token after "Bearer "
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
@IpList() all: string[]
```

## Gotchas

- `@Query('name')` → `undefined` when missing (not `null` / empty string).
- `@Res()` without `passthrough` suppresses handler-return processing entirely.
- Query / param / header values are always strings — coerce via pipes.
- `@Param` / `@Params` are from `moost`, the rest from `@moostjs/event-http`.
- Property-form resolvers require `@Injectable('FOR_EVENT')` (or a `FOR_EVENT` controller).
