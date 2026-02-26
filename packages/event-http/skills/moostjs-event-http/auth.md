# Authentication — @moostjs/event-http

> Declarative auth guards with automatic credential extraction and Swagger integration.

## Concepts

The auth guard system has three components:

1. **Transport declaration** — describes *where* credentials come from (bearer token, basic auth, API key, cookie)
2. **Guard handler** — your verification logic, receives the extracted credentials
3. **`@Authenticate` decorator** — applies the guard to a controller or handler

Two APIs are provided:
- **Functional** (`defineAuthGuard`) — stateless, simple guards
- **Class-based** (`AuthGuard`) — when you need dependency injection

Auth guard transport declarations are stored in metadata, enabling automatic Swagger/OpenAPI security scheme discovery.

## API Reference

### `defineAuthGuard(transports, handler)`

Create a functional auth guard.

```ts
import { defineAuthGuard, HttpError } from '@moostjs/event-http'

const jwtGuard = defineAuthGuard(
  { bearer: { format: 'JWT' } },
  (transports) => {
    const user = verifyJwt(transports.bearer)
    if (!user) throw new HttpError(401, 'Invalid token')
    // return value is optional — if returned, it becomes the handler's response (short-circuit)
  },
)
```

**Parameters:**
- `transports: TAuthTransportDeclaration` — which credentials to extract
- `handler: (transports: TAuthTransportValues<T>) => unknown | Promise<unknown>` — verification logic

**Returns:** `TAuthGuardDef` — an interceptor def with transport metadata attached.

### `AuthGuard<T>`

Abstract base class for class-based auth guards. Use when you need DI.

```ts
import { AuthGuard, HttpError } from '@moostjs/event-http'
import { Injectable } from 'moost'

@Injectable()
class JwtGuard extends AuthGuard<{ bearer: { format: 'JWT' } }> {
  static transports = { bearer: { format: 'JWT' } } as const

  constructor(private userService: UserService) {}

  handle(transports: { bearer: string }) {
    const user = this.userService.verifyToken(transports.bearer)
    if (!user) throw new HttpError(401, 'Invalid token')
  }
}
```

Requirements:
- Extend `AuthGuard<T>` with transport declaration as generic parameter
- Set `static transports` matching the generic (read at runtime)
- Implement `handle(transports)` with verification logic
- Use `@Injectable()` for constructor injection

### `@Authenticate(handler)`

Apply an auth guard to a controller or handler method.

```ts
import { Authenticate, Get } from '@moostjs/event-http'
import { Controller } from 'moost'

// Controller-level — all handlers require auth
@Authenticate(jwtGuard)
@Controller('users')
class UsersController {
  @Get('')
  list() {}

  @Get(':id')
  find() {}
}

// Handler-level — specific endpoints only
@Controller('products')
class ProductsController {
  @Get('')
  list() { /* public */ }

  @Authenticate(jwtGuard)
  @Post('')
  create() { /* requires auth */ }
}
```

Accepts both functional (`TAuthGuardDef`) and class-based (`TAuthGuardClass`) guards.

### `extractTransports(declaration)`

Low-level function that extracts credentials from the current request context. Called internally by auth guards — rarely needed directly.

```ts
import { extractTransports } from '@moostjs/event-http'

const values = extractTransports({ bearer: { format: 'JWT' } })
// values.bearer = 'eyJ...' (the raw token)
```

Throws `HttpError(401, 'No authentication credentials provided')` if none of the declared transports are present.

## Transport types

### Bearer token

Extracts from `Authorization: Bearer <token>`:

```ts
{ bearer: { format?: string, description?: string } }
// Extracted value: string (raw token without "Bearer " prefix)
```

### Basic authentication

Extracts from `Authorization: Basic <base64>`:

```ts
{ basic: { description?: string } }
// Extracted value: { username: string, password: string }
```

### API key

Extracts from a header, query parameter, or cookie:

```ts
{ apiKey: { name: string, in: 'header' | 'query' | 'cookie', description?: string } }
// Extracted value: string
```

```ts
// From header
defineAuthGuard({ apiKey: { name: 'X-API-Key', in: 'header' } }, (t) => { t.apiKey /* string */ })

// From query param
defineAuthGuard({ apiKey: { name: 'api_key', in: 'query' } }, (t) => { t.apiKey /* string */ })

// From cookie
defineAuthGuard({ apiKey: { name: 'api_key', in: 'cookie' } }, (t) => { t.apiKey /* string */ })
```

### Cookie

Extracts a value from a named cookie:

```ts
{ cookie: { name: string, description?: string } }
// Extracted value: string
```

## Common Patterns

### Pattern: JWT bearer guard

```ts
const jwtGuard = defineAuthGuard(
  { bearer: { format: 'JWT', description: 'JWT access token' } },
  (transports) => {
    const payload = verifyJwt(transports.bearer)
    if (!payload) throw new HttpError(401, 'Invalid or expired token')
  },
)
```

### Pattern: API key guard

```ts
const apiKeyGuard = defineAuthGuard(
  { apiKey: { name: 'X-API-Key', in: 'header' } },
  (transports) => {
    if (!isValidApiKey(transports.apiKey)) {
      throw new HttpError(401, 'Invalid API key')
    }
  },
)
```

### Pattern: Auth + authorization stacking

```ts
@Authenticate(jwtGuard)          // step 1: verify credentials
@RequireRole('admin')            // step 2: check authorization
@Controller('admin')
class AdminController {
  @Get('dashboard')
  dashboard() { /* authenticated + admin */ }
}
```

### Pattern: Class-based guard with DI

```ts
@Injectable()
class SessionGuard extends AuthGuard<{ cookie: { name: 'session' } }> {
  static transports = { cookie: { name: 'session' } } as const

  constructor(private sessionService: SessionService) {}

  handle(transports: { cookie: string }) {
    const session = this.sessionService.validate(transports.cookie)
    if (!session) throw new HttpError(401, 'Invalid session')
  }
}

@Authenticate(SessionGuard)
@Controller('dashboard')
class DashboardController {}
```

### Pattern: Handler-level override

```ts
@Authenticate(apiKeyGuard)
@Controller('products')
class ProductsController {
  @Get('')
  list() { /* uses apiKeyGuard */ }

  @Authenticate(basicGuard)
  @Post('')
  create() { /* uses basicGuard instead */ }
}
```

## Integration

- **Swagger**: Transport declarations map directly to OpenAPI security schemes. The `@moostjs/swagger` package auto-discovers `@Authenticate` metadata.
- **Guards**: Auth guards run at `GUARD` priority. Combine with custom authorization guards (also at `GUARD` priority) — they execute in decorator declaration order.

## Types

```ts
interface TAuthTransportDeclaration {
  bearer?: { format?: string; description?: string }
  basic?: { description?: string }
  apiKey?: { name: string; in: 'header' | 'query' | 'cookie'; description?: string }
  cookie?: { name: string; description?: string }
}

type TAuthTransportValues<T> = {
  [K in keyof T]: K extends 'basic' ? { username: string; password: string } : string
}

type TAuthGuardHandler = TAuthGuardDef | TAuthGuardClass
```

## Best Practices

- Use functional guards (`defineAuthGuard`) for simple, stateless checks
- Use class-based guards (`AuthGuard`) when you need DI services (e.g., database, token service)
- Apply `@Authenticate` at the controller level for protected resources, handler level for mixed access
- Always throw `HttpError` with meaningful messages for auth failures
- Combine with `@moostjs/swagger` for automatic OpenAPI security documentation

## Gotchas

- If none of the declared transports are present in the request, `extractTransports` throws `HttpError(401)` automatically — your handler won't be called
- Class-based guards must set `static transports` — it's read at runtime, not from the generic parameter
- Auth guards run at `GUARD` priority — they execute before `INTERCEPTOR`-priority interceptors
- The handler's return value (if any) short-circuits the response — use this for redirects or custom auth responses
