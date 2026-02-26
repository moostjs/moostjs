# Responses & Errors

Moost converts your handler's return value into an HTTP response automatically. This page covers response formats, status codes, headers, cookies, error handling, and raw response access.

## Automatic response handling

The return value of a handler determines the response:

| Return type | Content-Type | Behavior |
|---|---|---|
| `string` | `text/plain` | Sent as plain text |
| object / array | `application/json` | JSON-serialized |
| `boolean` | `application/json` | JSON-serialized |
| `ReadableStream` | streamed | Piped to response |
| fetch `Response` | forwarded | Status, headers, and body preserved |

`content-length` is set automatically for non-streamed responses.

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

### Dynamic — `@StatusHook`

When the status code depends on runtime logic:

```ts
import { Get, StatusHook } from '@moostjs/event-http'
import type { TStatusHook } from '@moostjs/event-http'

@Get('process')
process(@StatusHook() status: TStatusHook) {
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

### Dynamic — `@HeaderHook`

```ts
import { Get, HeaderHook } from '@moostjs/event-http'
import type { THeaderHook } from '@moostjs/event-http'

@Get('test')
test(@HeaderHook('x-custom') header: THeaderHook) {
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

### Dynamic — `@CookieHook`

```ts
import { Post, CookieHook } from '@moostjs/event-http'
import type { TCookieHook } from '@moostjs/event-http'

@Post('login')
login(@CookieHook('session') cookie: TCookieHook) {
    const token = generateToken()
    cookie.value = token
    cookie.attrs = { maxAge: '1h', httpOnly: true, secure: true }
    return { ok: true }
}
```

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
