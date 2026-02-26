# Routing & Handlers

Every endpoint in Moost starts with an HTTP method decorator and a route path. This page covers how to define routes, use parameters, and control which methods your handlers respond to.

## HTTP method decorators

Moost provides a decorator for each HTTP method:

| Decorator | HTTP Method |
|-----------|-------------|
| `@Get(path?)` | GET |
| `@Post(path?)` | POST |
| `@Put(path?)` | PUT |
| `@Delete(path?)` | DELETE |
| `@Patch(path?)` | PATCH |
| `@All(path?)` | All methods |

All decorators are imported from `@moostjs/event-http`.

```ts
import { Get, Post, Put, Delete, Patch } from '@moostjs/event-http'
import { Controller, Param } from 'moost'

@Controller('users')
export class UserController {
    @Get('')
    list() {
        return [] // GET /users
    }

    @Get(':id')
    find(@Param('id') id: string) {
        return { id } // GET /users/123
    }

    @Post('')
    create() {
        return { created: true } // POST /users
    }

    @Delete(':id')
    remove(@Param('id') id: string) {
        return { deleted: id } // DELETE /users/123
    }
}
```

### Path defaults

The `path` argument is optional. When omitted, the method name becomes the path:

```ts
@Get()
getUsers() { /* GET /getUsers */ }

@Get('')
root() { /* GET / (root of controller) */ }

@Get('list')
getUsers() { /* GET /list */ }
```

::: tip
Use `@Get('')` (empty string) to handle the controller's root path. Omitting the argument entirely uses the method name as the path segment.
:::

### HEAD, OPTIONS, and custom methods

For HTTP methods without a convenience decorator, use `@HttpMethod`:

```ts
import { HttpMethod } from '@moostjs/event-http'

@HttpMethod('HEAD', 'health')
healthCheck() { /* HEAD /health */ }

@HttpMethod('OPTIONS', '')
cors() { /* OPTIONS / */ }
```

## Route parameters

Dynamic segments in a route are prefixed with `:`. Use `@Param('name')` to extract them.

```ts
@Get('users/:id')
getUser(@Param('id') id: string) {
    return { id }
}
```

### Multiple parameters

Parameters can be separated by slashes or hyphens:

```ts
// Slash-separated: /flights/SFO/LAX
@Get('flights/:from/:to')
getFlight(
    @Param('from') from: string,
    @Param('to') to: string,
) { /* ... */ }

// Hyphen-separated: /dates/2024-01-15
@Get('dates/:year-:month-:day')
getDate(
    @Param('year') year: string,
    @Param('month') month: string,
    @Param('day') day: string,
) { /* ... */ }
```

### Regex-constrained parameters

Restrict a parameter's shape with a regex pattern in parentheses:

```ts
// Only matches two-digit hours and minutes: /time/09h30m
@Get('time/:hours(\\d{2})h:minutes(\\d{2})m')
getTime(
    @Param('hours') hours: string,
    @Param('minutes') minutes: string,
) { /* ... */ }
```

### Repeated parameters (arrays)

When the same parameter name appears multiple times, the value becomes an array:

```ts
// /rgb/255/128/0 → color = ['255', '128', '0']
@Get('rgb/:color/:color/:color')
getRgb(@Param('color') color: string[]) { /* ... */ }
```

### All parameters at once

Use `@Params()` to get every route parameter as an object:

```ts
@Get('asset/:type/:type/:id')
getAsset(@Params() params: { type: string[], id: string }) {
    return params
}
```

## Wildcards

An asterisk (`*`) matches zero or more characters within a path segment.

```ts
@Controller('static')
export class StaticController {
    // Matches /static/anything/here
    @Get('*')
    handleAll(@Param('*') path: string) { /* ... */ }

    // Matches /static/bundle.js, /static/vendor.js
    @Get('*.js')
    handleJS(@Param('*') path: string) { /* ... */ }

    // Multiple wildcards → array
    @Get('*/test/*')
    handleTest(@Param('*') paths: string[]) { /* ... */ }

    // Regex on wildcard: only digits
    @Get('*(\\d+)')
    handleNumbers(@Param('*') path: string) { /* ... */ }
}
```

## Query parameters

Query strings (`?key=value`) are not part of the route path. Use `@Query` to extract them:

```ts
import { Get, Query } from '@moostjs/event-http'

@Get('search')
search(
    @Query('q') query: string,
    @Query('page') page: string,
) {
    return { query, page }
}
// GET /search?q=moost&page=2 → { query: 'moost', page: '2' }
```

Use `@Query()` without arguments to get all query parameters as an object:

```ts
@Get('search')
search(@Query() params: Record<string, string>) {
    return params
}
```

::: info
Query values are always strings. Use [pipes](./resolvers) to transform them to numbers or other types.
:::

## Handler return values

Whatever your handler returns becomes the response body. Moost automatically sets `content-type` and `content-length`:

| Return type | Content-Type |
|---|---|
| `string` | `text/plain` |
| object / array | `application/json` |
| `ReadableStream` | streamed |
| `Response` (fetch) | forwarded as-is |

```ts
@Get('text')
getText() {
    return 'Hello!' // → text/plain
}

@Get('json')
getJson() {
    return { message: 'Hello!' } // → application/json
}
```

Async handlers work the same way — return a promise:

```ts
@Get('data')
async getData() {
    const data = await fetchFromDb()
    return data
}
```
