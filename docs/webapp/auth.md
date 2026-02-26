# Authentication

Moost provides a declarative auth guard system that handles credential extraction from HTTP requests. Auth guards declare which **transports** they accept (bearer token, basic credentials, API key, cookie) and receive the extracted values in a handler function.

Auth guards also integrate with `@moostjs/swagger` for automatic security scheme documentation.

## Functional auth guards

Use `defineAuthGuard()` for straightforward, standalone guards:

```ts
import { defineAuthGuard, HttpError } from '@moostjs/event-http'

const jwtGuard = defineAuthGuard(
    { bearer: { format: 'JWT' } },
    (transports) => {
        const token = transports.bearer // raw token, no "Bearer " prefix
        const user = verifyJwt(token)
        if (!user) {
            throw new HttpError(401, 'Invalid token')
        }
    },
)
```

The first argument declares the transports (what credentials to extract). The second is your verification logic.

### Applying auth guards

Use `@Authenticate` at the controller or handler level:

```ts
import { Authenticate, Get } from '@moostjs/event-http'
import { Controller } from 'moost'

@Authenticate(jwtGuard)
@Controller('users')
export class UsersController {
    @Get('')
    list() { /* all handlers require bearer auth */ }

    @Get(':id')
    find() { /* inherited from controller */ }
}
```

Apply at the handler level for specific endpoints:

```ts
@Controller('products')
export class ProductsController {
    @Get('')
    list() { /* public */ }

    @Authenticate(jwtGuard)
    @Post('')
    create() { /* requires auth */ }
}
```

## Transport types

### Bearer token

Extracts from `Authorization: Bearer <token>`:

```ts
defineAuthGuard(
    { bearer: { format: 'JWT', description: 'JWT access token' } },
    (transports) => {
        transports.bearer // string — raw token without "Bearer " prefix
    },
)
```

### Basic authentication

Extracts from `Authorization: Basic <base64>`:

```ts
defineAuthGuard(
    { basic: { description: 'Admin credentials' } },
    (transports) => {
        transports.basic.username // string
        transports.basic.password // string
    },
)
```

### API key

Extracts a key from a header, query parameter, or cookie:

```ts
// From a header
defineAuthGuard(
    { apiKey: { name: 'X-API-Key', in: 'header' } },
    (transports) => {
        transports.apiKey // string
    },
)

// From a query parameter
defineAuthGuard(
    { apiKey: { name: 'api_key', in: 'query' } },
    (transports) => {
        transports.apiKey // string
    },
)

// From a cookie
defineAuthGuard(
    { apiKey: { name: 'api_key', in: 'cookie' } },
    (transports) => {
        transports.apiKey // string
    },
)
```

### Cookie

Extracts a value from a named cookie:

```ts
defineAuthGuard(
    { cookie: { name: 'session_token' } },
    (transports) => {
        transports.cookie // string
    },
)
```

## Class-based auth guards

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
- Extend `AuthGuard<T>` with your transport declaration as the generic
- Set `static transports` to match (read at runtime)
- Implement `handle(transports)` with your verification logic
- Use `@Injectable()` for constructor injection

Apply identically:

```ts
@Authenticate(JwtGuard)
@Controller('users')
export class UsersController { /* ... */ }
```

## Handler-level overrides

When `@Authenticate` is applied at both controller and handler level, the handler-level guard wins:

```ts
@Authenticate(apiKeyGuard)
@Controller('products')
export class ProductsController {
    @Get('')
    list() { /* uses apiKeyGuard */ }

    @Authenticate(basicGuard)
    @Post('')
    create() { /* uses basicGuard instead */ }
}
```

## Credential extraction

When the guard runs, it inspects the request for the declared transports. If **none** of the declared credentials are present, it throws `HttpError(401, 'No authentication credentials provided')` before your handler is called.

## Swagger integration

Auth guards are automatically documented in the OpenAPI spec. Transport declarations map directly to OpenAPI security schemes. See [Swagger Security](/swagger/security) for fine-grained control with `@SwaggerPublic()` and `@SwaggerSecurity()`.
