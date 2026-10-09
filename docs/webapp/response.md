# Responses & Errors

Moost converts your handler's return value into an HTTP response automatically. This page covers response formats, status codes, headers, cookies, compression, error handling, and raw response access.

## Automatic response handling

The return value of a handler determines the response:

| Return type | Content-Type | Behavior |
|---|---|---|
| `string` | `text/plain` | Sent as plain text |
| object / array | `application/json` | JSON-serialized |
| `boolean` / `number` | `text/plain` | Stringified (`'true'`, `'42'`) |
| Node `Readable` stream | streamed | Piped to response (e.g. `fs.createReadStream()`) |
| fetch `Response` | forwarded | Status, headers, and body preserved |

`content-length` is set automatically for non-streamed responses.

::: warning
Web `ReadableStream` is not special-cased — it would be JSON-serialized like a plain object. Wrap it with `Readable.fromWeb()` from `node:stream` or return it inside a fetch `Response`.
:::

## Setting status codes

### Static — `@SetStatus`

When the status code is always the same:

```ts
import { Post, SetStatus } from '@moostjs/event-http'
import { Controller } from 'moost'

@Controller('users')
export class UserController {
    @Post('')
    @SetStatus(201)
    create() {
        return { created: true } // always responds with 201
    }
}
```

By default, `@SetStatus` won't override a status code that was already set (e.g., by an error). Pass `{ force: true }` to always override:

```ts
@SetStatus(200, { force: true })
```

### Dynamic — `@StatusRef`

When the status code depends on runtime logic:

```ts
import { Get, StatusRef } from '@moostjs/event-http'
import type { TStatusRef } from '@moostjs/event-http'

@Get('process')
process(@StatusRef() status: TStatusRef) {
    if (someCondition) {
        status.value = 202 // Accepted
        return { status: 'processing' }
    }
    return { status: 'done' } // default 200
}
```

## Setting headers

### Static — `@SetHeader`

```ts
import { Get, SetHeader } from '@moostjs/event-http'

@Get('test')
@SetHeader('x-powered-by', 'moost')
@SetHeader('cache-control', 'no-store')
test() {
    return 'ok'
}
```

`@SetHeader` supports additional options:

```ts
// Only set this header when the response status is 400
@SetHeader('content-type', 'text/plain', { status: 400 })

// Override even if the header was already set
@SetHeader('x-custom', 'value', { force: true })

// Set on both success and error responses
@SetHeader('x-request-id', 'abc', { when: 'always' })

// Set only on error responses
@SetHeader('x-error', 'true', { when: 'error' })
```

### Dynamic — `@HeaderRef`

```ts
import { Get, HeaderRef } from '@moostjs/event-http'
import type { THeaderRef } from '@moostjs/event-http'

@Get('test')
test(@HeaderRef('x-custom') header: THeaderRef) {
    header.value = `generated-${Date.now()}`
    return 'ok'
}
```

## Setting cookies

### Static — `@SetCookie`

```ts
import { Get, SetCookie } from '@moostjs/event-http'

@Get('login')
@SetCookie('session', 'abc123', { maxAge: '1h', httpOnly: true })
login() {
    return { ok: true }
}
```

::: info
`@SetCookie` won't overwrite a cookie that was already set in the response. This prevents accidental overwrites when multiple decorators or interceptors set the same cookie.
:::

### Dynamic — `@CookieRef`

```ts
import { Post, CookieRef, CookieAttrsRef } from '@moostjs/event-http'
import type { TCookieRef, TCookieAttributes } from '@moostjs/event-http'

@Post('login')
login(
    @CookieRef('session') cookie: TCookieRef,
    @CookieAttrsRef('session') attrs: { value: TCookieAttributes },
) {
    const token = generateToken()
    cookie.value = token
    attrs.value = { maxAge: '1h', httpOnly: true, secure: true }
    return { ok: true }
}
```

## Response compression

Since `0.6.49` (wooks `0.7.28`), the HTTP adapter can compress response bodies with brotli or gzip, picking the coding from the request's `Accept-Encoding` header. It is **off by default**. Turn it on with the `compression` option of `MoostHttp`, which is passed to wooks' `createHttpApp`:

```ts
import { MoostHttp } from '@moostjs/event-http'
import { Moost } from 'moost'

const app = new Moost()
void app.adapter(new MoostHttp({ compression: true })).listen(3000)
void app.init()
```

`compression: true` uses the defaults: bodies of at least 1 KB with a compressible `Content-Type` (text, JSON, XML, JavaScript, SVG, …), brotli preferred over gzip. Pass an object to change them:

```ts
new MoostHttp({
    compression: {
        threshold: 2048,     // bytes, default 1024
        encodings: ['gzip'], // default ['br', 'gzip']
        brotliQuality: 4,    // default 4
        gzipLevel: 6,        // default 6
        // filter: (contentType, response) => boolean — default isCompressibleType
    },
})
```

Streams, `text/event-stream`, `HEAD`, `204`/`304`, responses that already have `Content-Encoding` and in-process calls ([local fetch](./fetch)) are never compressed. The wooks guide [Response Compression](https://wooks.moost.org/webapp/compression.html) covers the full rules: what gets compressed, `Vary` and `ETag` handling, pre-serialized JSON and performance.

### Per handler — `@Compress`

`@Compress()` overrides the app setting for a handler or, on a class, for every handler of the controller:

```ts
import { Compress, Get } from '@moostjs/event-http'
import { Controller } from 'moost'

@Controller('reports')
export class ReportsController {
    @Get('full')
    @Compress() // compress even when the app has compression off
    full() {
        return buildLargeReport()
    }

    @Get('archive')
    @Compress({ brotliQuality: 6, threshold: 4096 }) // layered over the app settings
    archive() {
        return buildArchive()
    }

    @Get('session')
    @Compress(false) // carries a token next to reflected input — never compress (BREACH)
    session() {
        return { token, echo: query }
    }
}
```

| Argument | Effect |
|---|---|
| none / `true` | Compress with the app settings, or the defaults when the app has compression off |
| `false` | Never compress this response |
| options object | Compress with these settings layered over the app settings (or the defaults) |

A method-level `@Compress` replaces a class-level one — options are layered over the app settings, never over the class value. The override is applied before guards and argument resolution, so it also covers error responses from guards, pipes and the handler. Unmatched routes (404) follow the app setting.

For a decision made at runtime, call the wooks composable inside the handler:

```ts
import { useResponse } from '@wooksjs/event-http'

@Get('search')
search(@Query('q') q: string) {
    if (containsSecret) useResponse().setCompression(false)
    return results
}
```

`isCompressibleType` (the default `filter`) and the `THttpCompressionOptions` / `THttpCompressionEncoding` types are re-exported from `@moostjs/event-http`.

::: warning BREACH
Compression leaks information through the response size. When a body contains a **secret** (CSRF token, API key, session token) **and** text an attacker can influence (a reflected query parameter, a search term), the secret can be recovered from compressed sizes. Put `@Compress(false)` on such handlers, or keep secrets and reflected input in separate responses. See [Security: BREACH](https://wooks.moost.org/webapp/compression.html#security-breach) in the wooks guide.
:::

::: tip
Compress in one layer only. If a reverse proxy or a Connect `compression()` middleware already compresses API responses, leave the adapter's `compression` off.
:::

## Error handling

### Unhandled errors

Any uncaught exception becomes an HTTP 500 response:

```ts
@Get('fail')
fail() {
    throw new Error('Something broke')
    // → 500 Internal Server Error
}
```

### HttpError

Use `HttpError` to throw errors with specific HTTP status codes:

```ts
import { HttpError } from '@moostjs/event-http'

@Get('secret')
secret() {
    throw new HttpError(403, 'Access denied')
    // → 403 Forbidden with message "Access denied"
}
```

### Detailed error responses

Pass an object for structured error bodies:

```ts
throw new HttpError(422, {
    message: 'Validation failed',
    statusCode: 422,
    errors: [
        { field: 'email', message: 'Invalid email format' },
        { field: 'age', message: 'Must be a positive number' },
    ],
})
```

The response format (JSON or HTML) adapts based on the request's `Accept` header.

### Error interceptors

For centralized error handling across multiple handlers, see [Interceptors](./interceptors).

## Raw response

For full control over the response, use `@Res()` to access the raw `ServerResponse`. When you do, the framework does **not** process the handler's return value — you're responsible for the entire response.

```ts
import { Get, Res } from '@moostjs/event-http'
import type { ServerResponse } from 'http'

@Get('raw')
raw(@Res() res: ServerResponse) {
    res.writeHead(200, { 'content-type': 'text/plain' })
    res.end('Manual response')
}
```

### Passthrough mode

If you need the raw response object but still want the framework to process your return value, use `{ passthrough: true }`:

```ts
@Get('hybrid')
hybrid(@Res({ passthrough: true }) res: ServerResponse) {
    res.setHeader('x-custom', 'value')
    return { data: 'processed by framework' } // framework handles this
}
```
