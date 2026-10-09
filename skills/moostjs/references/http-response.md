# HTTP Response Control — @moostjs/event-http

Set status, headers, cookies, compression, body limits, errors. Setup/routing: [event-http.md](event-http.md). Auth: [http-auth.md](http-auth.md).

- [Static decorators](#static-decorators)
- [Refs (dynamic)](#refs-dynamic)
- [Response compression](#response-compression)
- [Body limits](#body-limits)
- [HttpError](#httperror)
- [Types](#types)
- [Gotchas](#gotchas)

Static decorators register `AFTER_ALL`-priority interceptors. Refs are Proxy-based reactive bindings — set at runtime. Ref decorators work as parameter or property (on `FOR_EVENT`) decorators.

## Static decorators

### `@SetStatus(code, opts?)`

```ts
@Post('users') @SetStatus(201)
create() { return { created: true } }
@SetStatus(200, { force: true })   // override any status already set (handler or after hooks)
```

### `@SetHeader(name, value, opts?)`

```ts
@SetHeader('x-powered-by', 'moost')
@SetHeader('cache-control', 'no-store')
@SetHeader('content-type', 'text/plain', { status: 400 })
@SetHeader('x-error',      'true',       { when: 'error' })
@SetHeader('x-request-id', 'abc',        { when: 'always' })
```

Options: `force?: boolean` (by default `@SetHeader` skips headers already present in the response — pass `force: true` to overwrite), `status?: number` (only set when response has this status), `when?: 'always' | 'error' | 'ok'` (default `'ok'` = success-only).

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

## Response compression

Since 0.6.49 (wooks 0.7.28). OFF by default. App-level: `new MoostHttp({ compression: true | THttpCompressionOptions })` (passed to wooks `createHttpApp`). Options: `threshold` (1024 B), `encodings` (`['br', 'gzip']`, client q-values decide, order breaks ties), `brotliQuality` (4), `gzipLevel` (6), `filter(contentType, response)` (default `isCompressibleType` — text/JSON/XML/JS/SVG/NDJSON/WASM, not `text/event-stream`).

```ts
@Controller('reports')
@Compress(false) // class: every handler
class ReportsController {
  @Get('full')
  @Compress() // method replaces class (not layered on it); true = app settings or defaults
  full() {
    return bigReport()
  }
  @Get('arch')
  @Compress({ brotliQuality: 6, threshold: 4096 }) // layered over app settings
  arch() {
    return archive()
  }
}
// runtime: useResponse().setCompression(false)  (from @wooksjs/event-http)
```

`@Compress(value = true)` = `BEFORE_ALL` before-interceptor calling `useResponse().setCompression(value)` → runs before guards/arg resolution, so it also covers guard/pipe/handler error responses. 404s follow the app setting; non-HTTP events are skipped (gotcha 5). Re-exported: `isCompressibleType`, types `THttpCompressionOptions`, `THttpCompressionEncoding`.

Never compressed: streams / fetch `Response` bodies, `text/event-stream`, `HEAD`, `204`/`206`/`304`, bodies with `Content-Encoding` already set, `Cache-Control: no-transform`, in-process `fetch()`/`invoke()`/SSR local fetch. Adds `Vary: Accept-Encoding`; weakens a strong `ETag`. Full rules: https://wooks.moost.org/webapp/compression.html

**BREACH**: body with a secret (CSRF/session token, API key) + attacker-influenced text (reflected query) → `@Compress(false)` on that handler, or split secret and reflected input into separate responses. Compress in ONE layer (adapter OR proxy/`compression()` middleware) — a Connect `compression()` middleware still compresses `@Compress(false)` responses.

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

`TStatusRef` / `THeaderRef` / `TCookieRef` / `TCookieAttributes` are exported from `@moostjs/event-http`; mutate `.value` (value shapes shown inline in [Refs](#refs-dynamic)).

## Gotchas

1. `@SetStatus` registers an `after` hook only — never applied to error responses regardless of `force`. With `force` it overrides any status already set (by the handler via `@StatusRef`/`useResponse()` or by earlier after hooks); without `force` it is a no-op once any status is set.
2. `@SetCookie` won't overwrite a cookie already set in the response.
3. `@SetHeader` won't overwrite a header already set (e.g. via `@HeaderRef`) unless `force: true`; default `when` is `'ok'` (success-only) — use `'always'` or `'error'` to run on errors.
4. Ref decorators return Proxy objects — mutate `.value`, not a plain field.
5. `@SetStatus` / `@SetHeader` / `@SetCookie` / `@Compress` / body-limit decorators and `global…` limits act on HTTP events only — CLI / workflow / WS events of a mixed controller (also a workflow started from an HTTP handler with `eventContext`) are skipped, never touching the parent request/response.
6. Global limit interceptors apply to every HTTP handler.
