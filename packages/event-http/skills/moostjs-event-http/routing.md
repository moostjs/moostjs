# Routing & handlers — @moostjs/event-http

> Defining HTTP routes, methods, parameters, wildcards, and handler return values.

## Concepts

Every HTTP endpoint is defined by a method decorator (`@Get`, `@Post`, etc.) on a controller method. The decorator specifies the HTTP method and optional path. Route parameters (`:param`), wildcards (`*`), and regex constraints provide flexible URL matching. Controllers group related handlers under a shared prefix.

## API Reference

### HTTP method decorators

All imported from `@moostjs/event-http`:

| Decorator | HTTP Method | Usage |
|-----------|-------------|-------|
| `@Get(path?)` | GET | `@Get('users/:id')` |
| `@Post(path?)` | POST | `@Post('users')` |
| `@Put(path?)` | PUT | `@Put('users/:id')` |
| `@Delete(path?)` | DELETE | `@Delete('users/:id')` |
| `@Patch(path?)` | PATCH | `@Patch('users/:id')` |
| `@All(path?)` | All methods | `@All('proxy/*')` |
| `@HttpMethod(method, path?)` | Any method | `@HttpMethod('OPTIONS', '')` |
| `@Upgrade(path?)` | UPGRADE | `@Upgrade('/ws')` |

```ts
import { Get, Post, Put, Delete, Patch, All, HttpMethod, Upgrade } from '@moostjs/event-http'
```

### `@HttpMethod(method, path?)`

The base decorator — all convenience decorators (`@Get`, `@Post`, etc.) call this internally.

```ts
@HttpMethod('HEAD', 'health')
healthCheck() { /* HEAD /health */ }

@HttpMethod('OPTIONS', '')
cors() { /* OPTIONS / */ }
```

Valid methods: `'GET'`, `'PUT'`, `'POST'`, `'PATCH'`, `'DELETE'`, `'HEAD'`, `'OPTIONS'`, `'UPGRADE'`, `'*'`

### `@Upgrade(path?)`

Registers an UPGRADE route for WebSocket handshakes. Use with `@moostjs/event-ws`:

```ts
@Upgrade('/ws')
handleUpgrade(ws: WooksWs) {
  return ws.upgrade()
}
```

### Route parameters — `@Param` and `@Params`

Imported from `moost` (not from `@moostjs/event-http`):

```ts
import { Controller, Param, Params } from 'moost'
import { Get } from '@moostjs/event-http'

@Controller('users')
class UserController {
  @Get(':id')
  find(@Param('id') id: string) {
    return { id } // GET /users/123
  }

  @Get(':type/:type/:id')
  getAsset(@Params() params: { type: string[], id: string }) {
    return params
  }
}
```

## Common Patterns

### Pattern: Path defaults

```ts
@Get()         // path = method name, e.g. GET /getUsers
getUsers() {}

@Get('')       // path = controller root, e.g. GET /
root() {}

@Get('list')   // explicit path, e.g. GET /list
listItems() {}
```

### Pattern: Multiple parameters

```ts
// Slash-separated: /flights/SFO/LAX
@Get('flights/:from/:to')
getFlight(@Param('from') from: string, @Param('to') to: string) {}

// Hyphen-separated: /dates/2024-01-15
@Get('dates/:year-:month-:day')
getDate(
  @Param('year') year: string,
  @Param('month') month: string,
  @Param('day') day: string,
) {}
```

### Pattern: Regex-constrained parameters

```ts
// Only matches two-digit hours and minutes: /time/09h30m
@Get('time/:hours(\\d{2})h:minutes(\\d{2})m')
getTime(@Param('hours') hours: string, @Param('minutes') minutes: string) {}
```

### Pattern: Repeated parameters (arrays)

```ts
// /rgb/255/128/0 -> color = ['255', '128', '0']
@Get('rgb/:color/:color/:color')
getRgb(@Param('color') color: string[]) {}
```

### Pattern: Wildcards

```ts
@Controller('static')
class StaticController {
  @Get('*')
  handleAll(@Param('*') path: string) {}

  @Get('*.js')
  handleJS(@Param('*') name: string) {}

  // Multiple wildcards -> array
  @Get('*/test/*')
  handleTest(@Param('*') paths: string[]) {}

  // Regex on wildcard: only digits
  @Get('*(\\d+)')
  handleNumbers(@Param('*') path: string) {}
}
```

### Pattern: Controller prefix

```ts
import { Controller } from 'moost'

@Controller('api/v1/users')
class UserController {
  @Get('')     // GET /api/v1/users
  list() {}

  @Get(':id')  // GET /api/v1/users/123
  find() {}
}
```

### Pattern: Nested controllers

```ts
import { Controller, ImportController } from 'moost'

@Controller('api')
class ApiController {
  @ImportController(() => UserController)
  users!: UserController

  @ImportController(() => ProductController)
  products!: ProductController
}
// Routes: GET /api/users/..., GET /api/products/...
```

## Handler return values

Whatever the handler returns becomes the response body:

| Return type | Content-Type |
|-------------|--------------|
| `string` | `text/plain` |
| object / array | `application/json` |
| `ReadableStream` | streamed |
| fetch `Response` | forwarded as-is |

```ts
@Get('text')
getText() { return 'Hello!' }           // text/plain

@Get('json')
getJson() { return { message: 'Hi' } }  // application/json

@Get('data')
async getData() { return await fetchFromDb() }  // async works
```

## Best Practices

- Use `@Get('')` (empty string) for the controller root path, not `@Get()` (which uses the method name)
- Keep controller prefixes as REST resource names: `@Controller('users')`, `@Controller('products')`
- Use `@Param` for individual route parameters, `@Params` when you need the full params object
- Prefer convenience decorators (`@Get`, `@Post`) over `@HttpMethod` for standard methods

## Gotchas

- `@Get()` without arguments uses the **method name** as the path — this is rarely what you want
- Route parameters are always strings — use pipes to transform to numbers/booleans
- An explicit double slash `//` at the end of a path forces the URL to end with a trailing slash
- Query parameters are not part of the route path — use `@Query()` to extract them
