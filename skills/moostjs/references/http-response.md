# HTTP Response Control — @moostjs/event-http

Set status, headers, cookies, body limits, errors. Setup/routing: [event-http.md](event-http.md). Auth: [http-auth.md](http-auth.md).

- [Static decorators](#static-decorators)
- [Refs (dynamic)](#refs-dynamic)
- [Body limits](#body-limits)
- [HttpError](#httperror)
- [Types](#types)
- [Gotchas](#gotchas)

Static decorators register `AFTER_ALL`-priority interceptors. Refs are Proxy-based reactive bindings — set at runtime. Ref decorators work as parameter, property (on `FOR_EVENT`), or method decorator.

## Static decorators

### `@SetStatus(code, opts?)`

```ts
@Post('users') @SetStatus(201)
create() { return { created: true } }
@SetStatus(200, { force: true })   // override status set by a prior `after` hook
```

### `@SetHeader(name, value, opts?)`

```ts
@SetHeader('x-powered-by', 'moost')
@SetHeader('cache-control', 'no-store')
@SetHeader('content-type', 'text/plain', { status: 400 })
@SetHeader('x-error',      'true',       { when: 'error' })
@SetHeader('x-request-id', 'abc',        { when: 'always' })
```

Options: `force?: boolean`, `status?: number` (only set when response has this status), `when?: 'always' | 'error' | 'ok'` (default `'ok'` = success-only).

### `@SetCookie(name, value, attrs?)`

Only sets if the cookie hasn't been set yet in the response.

```ts
@SetCookie('session', 'abc123', { maxAge: '1h', httpOnly: true })
```

`TCookieAttributesInput`: `maxAge`, `expires`, `domain`, `path`, `secure`, `httpOnly`, `sameSite`, etc.

## Refs (dynamic)

### `@StatusRef()`

```ts
@Get('process')
process(@StatusRef() status: TStatusRef) {
  if (cond) status.value = 202
  return { status: 'processing' }
}
```

Property form (needs `FOR_EVENT`):

```ts
@Injectable('FOR_EVENT') @Controller()
class C {
  @StatusRef() status = 200
  @Get('test') test() { this.status = 201; return 'created' }
}
```

### `@HeaderRef(name)` / `@CookieRef(name)` / `@CookieAttrsRef(name)`

```ts
@HeaderRef('x-custom')      header: THeaderRef     // value: string | string[] | undefined
@CookieRef('session')       cookie: TCookieRef     // { value, attrs? }
@CookieAttrsRef('session')  attrs:  { value: TCookieAttributes }
```

Usage:

```ts
header.value = `generated-${Date.now()}`
cookie.value = generateToken()
attrs.value  = { maxAge: '1h', httpOnly: true, secure: true }
```

## Body limits

All interceptor-based. Per-handler (`@…`) or global (`global…`).

```ts
@Post('upload')
@BodySizeLimit(50 * 1024 * 1024)            // max inflated — default 10 MB
@CompressedBodySizeLimit(5 * 1024 * 1024)   // max compressed — default 1 MB
@BodyReadTimeoutMs(30_000)                  // read timeout — default 10 s
upload() {}

// Global:
app.applyGlobalInterceptors(
  globalBodySizeLimit(20 * 1024 * 1024),
  globalCompressedBodySizeLimit(2 * 1024 * 1024),
  globalBodyReadTimeoutMs(15_000),
)
```

## HttpError

```ts
throw new HttpError(404, 'Not Found')
throw new HttpError(422, { message: 'Validation failed', errors: [...] })
```

Uncaught exceptions → HTTP 500. Format (JSON vs HTML) adapts to the `Accept` header.

## Types

```ts
interface TStatusRef { value: number }
interface THeaderRef { value: string | string[] | undefined }
interface TCookieRef { value: string; attrs?: TCookieAttributes }
type TCookieAttributes = Partial<TCookieAttributesRequired>
```

## Gotchas

- `@SetStatus` registers an `after` hook only — never applied to error responses regardless of `force`. `force` only overrides a status set by a prior `after` hook.
- `@SetCookie` won't overwrite a cookie already set in the response.
- `@SetHeader` default `when` is `'ok'` (success-only); use `'always'` or `'error'` to run on errors.
- Ref decorators return Proxy objects — mutate `.value`, not a plain field.
- Global limit interceptors apply to every handler.
