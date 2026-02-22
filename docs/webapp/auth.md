# Authentication Guards

`@moostjs/event-http` provides a declarative auth guard system that handles credential extraction from HTTP requests and integrates with `@moostjs/swagger` for automatic security scheme documentation.

## Overview

Auth guards declare which **transports** they accept (bearer token, basic credentials, API key, cookie) and receive the extracted values in a handler. The `@Authenticate` decorator registers the guard as an interceptor and stores transport metadata for swagger auto-discovery.

## Functional API

Use `defineAuthGuard()` for simple, standalone guards:

```ts
import { defineAuthGuard, HttpError } from '@moostjs/event-http'

export const jwtGuard = defineAuthGuard(
  { bearer: { format: 'JWT' } },
  (transports) => {
    const token = transports.bearer // raw token, no "Bearer " prefix
    const user = verifyJwt(token)
    if (!user) {
      throw new HttpError(401, 'Invalid token')
    }
    return user // returned value is discarded by default
  }
)
```

The first argument declares the transports. The second is the handler that receives the extracted values.

### Applying the guard

```ts
import { Authenticate, Get } from '@moostjs/event-http'
import { Controller } from 'moost'

@Authenticate(jwtGuard)
@Controller('users')
export class UsersController {
  @Get()
  list() { /* all handlers require bearer auth */ }

  @Get(':id')
  find() { /* inherited from controller */ }
}
```

Apply `@Authenticate()` at the controller level to protect all handlers, or at the handler level for specific endpoints.

## Class-based API

Use the `AuthGuard` base class when you need dependency injection:

```ts
import { AuthGuard, HttpError } from '@moostjs/event-http'
import { Injectable } from 'moost'

@Injectable()
export class JwtGuard extends AuthGuard<{ bearer: { format: 'JWT' } }> {
  static transports = { bearer: { format: 'JWT' } } as const

  constructor(private userService: UserService) {}

  handle(transports: { bearer: string }) {
    const user = this.userService.verifyToken(transports.bearer)
    if (!user) {
      throw new HttpError(401, 'Invalid token')
    }
  }
}
```

Key points:
- Extend `AuthGuard<T>` with your transport declaration as the generic parameter
- Set `static transports` to match the generic (this is read at runtime)
- Implement `handle(transports)` with your verification logic
- Use `@Injectable()` to enable constructor injection

### Applying a class-based guard

```ts
@Authenticate(JwtGuard)
@Controller('users')
export class UsersController { /* ... */ }
```

The usage is identical to functional guards.

## Transport types

### Bearer token

Extracts the token from the `Authorization: Bearer <token>` header.

```ts
defineAuthGuard(
  { bearer: { format: 'JWT', description: 'JWT access token' } },
  (transports) => {
    transports.bearer // string - raw token without "Bearer " prefix
  }
)
```

### Basic authentication

Extracts username and password from the `Authorization: Basic <base64>` header.

```ts
defineAuthGuard(
  { basic: { description: 'Admin credentials' } },
  (transports) => {
    transports.basic.username // string
    transports.basic.password // string
  }
)
```

### API key

Extracts a key from a header, query parameter, or cookie.

```ts
// From a header
defineAuthGuard(
  { apiKey: { name: 'X-API-Key', in: 'header' } },
  (transports) => {
    transports.apiKey // string
  }
)

// From a query parameter
defineAuthGuard(
  { apiKey: { name: 'api_key', in: 'query' } },
  (transports) => {
    transports.apiKey // string
  }
)

// From a cookie
defineAuthGuard(
  { apiKey: { name: 'api_key', in: 'cookie' } },
  (transports) => {
    transports.apiKey // string
  }
)
```

### Cookie

Extracts a value from a named cookie.

```ts
defineAuthGuard(
  { cookie: { name: 'session_token' } },
  (transports) => {
    transports.cookie // string
  }
)
```

## Handler-level overrides

When `@Authenticate` is applied at both controller and handler level, the handler-level guard takes precedence at runtime:

```ts
@Authenticate(apiKeyGuard)
@Controller('products')
export class ProductsController {
  @Get()
  list() { /* uses apiKeyGuard */ }

  @Authenticate(basicGuard)
  @Post()
  create() { /* uses basicGuard instead */ }

  @Authenticate(cookieGuard)
  @Delete(':id')
  remove() { /* uses cookieGuard instead */ }
}
```

## Credential extraction

When the guard runs, `extractTransports()` inspects the incoming request for the declared transports. If **none** of the declared credentials are present, it throws `HttpError(401, 'No authentication credentials provided')` before your handler is called.

The extraction uses Wooks composables internally:
- `useAuthorization()` for bearer and basic
- `useCookies()` for cookie
- `useHeaders()` / `useSearchParams()` for apiKey

## Swagger integration

Auth guards are automatically documented in the OpenAPI spec. See [Security Schemes](/swagger/security) for details on how transport declarations map to OpenAPI security schemes and how to use `@SwaggerPublic()` and `@SwaggerSecurity()` for fine-grained control.
