# Response control — @moostjs/event-http

> Setting status codes, headers, cookies, handling errors, and controlling HTTP responses.

## Concepts

Moost provides two styles for response control:

1. **Static decorators** (`@SetStatus`, `@SetHeader`, `@SetCookie`) — applied via interceptors at `AFTER_ALL` priority, declarative and fixed
2. **Dynamic hooks** (`@StatusHook`, `@HeaderHook`, `@CookieHook`, `@CookieAttrsHook`) — Proxy-based reactive bindings, set values programmatically at runtime

Both work as method decorators. Hook decorators also work as parameter decorators and property decorators (on `FOR_EVENT`-scoped controllers).

## API Reference

### `@SetStatus(code, opts?)`

Set the response status code. Runs as an `after` interceptor.

```ts
import { Post, SetStatus } from '@moostjs/event-http'

@Post('users')
@SetStatus(201)
create() { return { created: true } }

// Force override even if status was already set
@SetStatus(200, { force: true })
```

### `@StatusHook()`

Dynamic status code control via a `{ value: number }` proxy object.

```ts
import { Get, StatusHook } from '@moostjs/event-http'
import type { TStatusHook } from '@moostjs/event-http'

@Get('process')
process(@StatusHook() status: TStatusHook) {
  if (someCondition) {
    status.value = 202
    return { status: 'processing' }
  }
  return { status: 'done' } // default 200
}
```

Works as a property decorator too:

```ts
@Injectable('FOR_EVENT')
@Controller()
class MyController {
  @StatusHook()
  status = 200  // initial value

  @Get('test')
  test() {
    this.status = 201  // reactive — sets the response status
    return 'created'
  }
}
```

### `@SetHeader(name, value, opts?)`

Set a response header. Runs as an `after` interceptor (and optionally on error).

```ts
import { Get, SetHeader } from '@moostjs/event-http'

@Get('test')
@SetHeader('x-powered-by', 'moost')
@SetHeader('cache-control', 'no-store')
test() { return 'ok' }
```

Options:

| Option | Type | Description |
|--------|------|-------------|
| `force` | `boolean` | Override header even if already set |
| `status` | `number` | Only set when response has this status |
| `when` | `'always' \| 'error' \| 'ok'` | When to apply (default: success only) |

```ts
@SetHeader('content-type', 'text/plain', { status: 400 })
@SetHeader('x-request-id', 'abc', { when: 'always' })
@SetHeader('x-error', 'true', { when: 'error' })
```

### `@HeaderHook(name)`

Dynamic header control via a `{ value: string | string[] | undefined }` proxy.

```ts
import { Get, HeaderHook } from '@moostjs/event-http'
import type { THeaderHook } from '@moostjs/event-http'

@Get('test')
test(@HeaderHook('x-custom') header: THeaderHook) {
  header.value = `generated-${Date.now()}`
  return 'ok'
}
```

### `@SetCookie(name, value, attrs?)`

Set a response cookie. Only sets if the cookie hasn't already been set in the response.

```ts
import { Get, SetCookie } from '@moostjs/event-http'

@Get('login')
@SetCookie('session', 'abc123', { maxAge: '1h', httpOnly: true })
login() { return { ok: true } }
```

Cookie attributes (`TCookieAttributesInput`): `maxAge`, `expires`, `domain`, `path`, `secure`, `httpOnly`, `sameSite`, etc.

### `@CookieHook(name)`

Dynamic cookie value control.

```ts
import { Post, CookieHook } from '@moostjs/event-http'
import type { TCookieHook } from '@moostjs/event-http'

@Post('login')
login(@CookieHook('session') cookie: TCookieHook) {
  cookie.value = generateToken()
  return { ok: true }
}
```

### `@CookieAttrsHook(name)`

Dynamic cookie attributes control.

```ts
import { Post, CookieAttrsHook } from '@moostjs/event-http'
import type { TCookieAttributes } from '@moostjs/event-http'

@Post('login')
login(@CookieAttrsHook('session') attrs: { value: TCookieAttributes }) {
  attrs.value = { maxAge: '1h', httpOnly: true, secure: true }
  return { ok: true }
}
```

## Body limits

Interceptor-based decorators for controlling request body parsing limits.

### `@BodySizeLimit(n)`

Limit the maximum inflated (decompressed) body size in bytes. Default: 10 MB.

```ts
import { Post, BodySizeLimit } from '@moostjs/event-http'

@Post('upload')
@BodySizeLimit(50 * 1024 * 1024) // 50 MB
upload() {}
```

### `@CompressedBodySizeLimit(n)`

Limit the maximum compressed body size in bytes. Default: 1 MB.

```ts
@Post('upload')
@CompressedBodySizeLimit(5 * 1024 * 1024) // 5 MB
upload() {}
```

### `@BodyReadTimeoutMs(n)`

Set the timeout for reading the request body in milliseconds. Default: 10 s.

```ts
@Post('upload')
@BodyReadTimeoutMs(30000) // 30 seconds
upload() {}
```

### Global limit interceptors

For applying limits globally:

```ts
import { globalBodySizeLimit, globalCompressedBodySizeLimit, globalBodyReadTimeoutMs } from '@moostjs/event-http'

const app = new Moost()
app.applyGlobalInterceptors(
  globalBodySizeLimit(20 * 1024 * 1024),
  globalCompressedBodySizeLimit(2 * 1024 * 1024),
  globalBodyReadTimeoutMs(15000),
)
```

## Error handling

### `HttpError`

Throw to produce an HTTP error response:

```ts
import { HttpError } from '@moostjs/event-http'

throw new HttpError(404, 'Not Found')
throw new HttpError(403, 'Access denied')
throw new HttpError(422, {
  message: 'Validation failed',
  statusCode: 422,
  errors: [
    { field: 'email', message: 'Invalid email format' },
  ],
})
```

Uncaught exceptions become HTTP 500 responses. The response format (JSON or HTML) adapts based on the `Accept` header.

## Common Patterns

### Pattern: CRUD with proper status codes

```ts
@Controller('items')
class ItemController {
  @Get('')
  list() { return items }

  @Post('')
  @SetStatus(201)
  create(@Body() data: CreateItemDto) { return createItem(data) }

  @Put(':id')
  update(@Param('id') id: string, @Body() data: UpdateItemDto) {
    return updateItem(id, data)
  }

  @Delete(':id')
  @SetStatus(204)
  remove(@Param('id') id: string) { deleteItem(id) }
}
```

### Pattern: Conditional response headers

```ts
@Get('data')
@SetHeader('x-cache', 'miss', { when: 'always' })
getData(@HeaderHook('x-cache') cache: THeaderHook) {
  const cached = getFromCache()
  if (cached) {
    cache.value = 'hit'
    return cached
  }
  return fetchFreshData()
}
```

## Types

```ts
export interface TStatusHook { value: number }
export interface THeaderHook { value: string | string[] | undefined }
export interface TCookieHook { value: string; attrs?: TCookieAttributes }
export type TCookieAttributes = Partial<TCookieAttributesRequired>
```

## Best Practices

- Use `@SetStatus` for fixed status codes (201 for creation, 204 for deletion)
- Use `@StatusHook` when the status depends on runtime logic
- Use `@SetHeader` for static headers, `@HeaderHook` for dynamic ones
- Apply body limits on upload endpoints to prevent abuse
- Use global limit interceptors for application-wide defaults

## Gotchas

- `@SetStatus` won't override a status already set (e.g., by an error) unless `{ force: true }` is passed
- `@SetCookie` won't overwrite a cookie already set in the response — this prevents accidental overwrites
- `@SetHeader` defaults to success-only (`after` interceptor); use `{ when: 'always' }` to include error responses
- Hook decorators use Proxy objects — the `.value` property is reactive, not a plain field
