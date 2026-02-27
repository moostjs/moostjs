# Security

`@moostjs/swagger` auto-discovers authentication requirements from `@Authenticate()` guards and generates `components.securitySchemes` and per-operation `security` arrays in the OpenAPI spec. No manual swagger configuration is needed for standard auth patterns.

## How it works

When you apply `@Authenticate(guard)` to a controller or handler, the decorator stores auth transport declarations in metadata. The swagger mapping engine reads these and:

1. Generates `securitySchemes` entries in `components`
2. Attaches `security` arrays to each protected operation

## Transport types

Four auth transports are supported, each mapping to an OpenAPI security scheme:

| Transport | Guard declaration | OpenAPI scheme | Auto-generated name |
|-----------|-------------------|----------------|---------------------|
| Bearer | `{ bearer: { format?: string } }` | `{ type: 'http', scheme: 'bearer' }` | `bearerAuth` |
| Basic | `{ basic: {} }` | `{ type: 'http', scheme: 'basic' }` | `basicAuth` |
| API key | `{ apiKey: { name, in } }` | `{ type: 'apiKey', name, in }` | `apiKeyAuth` |
| Cookie | `{ cookie: { name } }` | `{ type: 'apiKey', name, in: 'cookie' }` | `cookieAuth` |

## Example

```ts
import { Controller } from 'moost'
import { Authenticate, defineAuthGuard, Get, Param } from '@moostjs/event-http'
import { SwaggerPublic } from '@moostjs/swagger'

const jwtGuard = defineAuthGuard(
  { bearer: { format: 'JWT' } },
  (transports) => {
    // verify transports.bearer
  },
)

@Authenticate(jwtGuard)
@Controller('users')
export class UsersController {
  @SwaggerPublic()
  @Get()
  list() { /* public — no auth required */ }

  @Get(':id')
  find(@Param('id') id: string) { /* inherits bearer auth from controller */ }
}
```

Generated spec excerpt:

```json
{
  "components": {
    "securitySchemes": {
      "bearerAuth": {
        "type": "http",
        "scheme": "bearer",
        "bearerFormat": "JWT"
      }
    }
  },
  "paths": {
    "/users": {
      "get": { "security": [] }
    },
    "/users/{id}": {
      "get": { "security": [{ "bearerAuth": [] }] }
    }
  }
}
```

## Security decorators

### `@SwaggerPublic()`

Marks a handler or controller as requiring no authentication in the docs. Emits `security: []` on affected operations:

```ts
@SwaggerPublic()
@Get('health')
health() { /* no lock icon in Swagger UI */ }
```

::: tip
`@SwaggerPublic()` only affects the swagger spec. It does not skip the auth guard at runtime. To bypass the guard itself, add a runtime check inside the guard.
:::

### `@SwaggerSecurity(schemeName, scopes?)`

Explicitly sets a security requirement with OR semantics — any one of the listed requirements suffices. Multiple `@SwaggerSecurity` calls add alternative requirements:

```ts
// Requires oauth2 with specific scopes
@SwaggerSecurity('oauth2', ['read:users', 'write:users'])
@Post()
create(@Body() dto: CreateUserDto) { /* ... */ }

// Accepts either bearer OR apiKey (OR semantics)
@SwaggerSecurity('bearerAuth')
@SwaggerSecurity('apiKeyAuth')
@Get()
list() { /* ... */ }
```

### `@SwaggerSecurityAll(requirement)`

Sets a security requirement with AND semantics — all listed schemes must be satisfied simultaneously:

```ts
// Requires BOTH bearer and API key
@SwaggerSecurityAll({ bearerAuth: [], apiKeyAuth: [] })
@Get('admin')
adminOnly() { /* ... */ }
```

## Resolution precedence

When determining the `security` array for an operation, the first match wins:

1. Handler `@SwaggerPublic()` → `security: []`
2. Handler `@SwaggerSecurity()` / `@SwaggerSecurityAll()` → explicit requirement
3. Handler `@Authenticate()` → converted from transport declaration
4. Controller `@SwaggerPublic()` → `security: []`
5. Controller `@SwaggerSecurity()` / `@SwaggerSecurityAll()` → explicit requirement
6. Controller `@Authenticate()` → converted from transport declaration
7. None → `security` omitted (inherits global default if set)

Handler-level decorators always take priority over controller-level ones. This lets you override controller-wide auth on specific endpoints.

## Global security

Set a default security requirement and manual security schemes through [configuration options](/swagger/configuration):

```ts
const swagger = new SwaggerController({
  title: 'My API',
  securitySchemes: {
    oauth2: {
      type: 'oauth2',
      flows: {
        implicit: {
          authorizationUrl: 'https://auth.example.com/authorize',
          scopes: { 'read:users': 'Read users', 'write:users': 'Write users' },
        },
      },
    },
  },
  security: [{ oauth2: ['read:users'] }],
})
```

Manually defined `securitySchemes` are merged with auto-discovered ones. The root `security` array serves as the default for operations that don't specify their own.

## Multiple auth schemes

### OR — accept any one of several methods

To accept **either** JWT **or** API key, declare both transports in a **single guard**. `extractTransports()` collects whichever credentials are present and only throws when none are found:

```ts
const flexibleGuard = defineAuthGuard(
  { bearer: { format: 'JWT' }, apiKey: { name: 'X-API-Key', in: 'header' } },
  (transports) => {
    if (transports.bearer) { /* verify JWT */ }
    else if (transports.apiKey) { /* verify API key */ }
  },
)

@Controller('data')
export class DataController {
  @Authenticate(flexibleGuard)
  @Get()
  list() { /* ... */ }
}
```

The swagger mapping auto-discovers both transports and emits OR security (separate entries in the `security` array).

### AND — require all methods simultaneously

Stacking multiple `@Authenticate()` decorators registers separate interceptors that **all** run during the before phase. Every guard must pass:

```ts
const jwtGuard = defineAuthGuard(
  { bearer: { format: 'JWT' } },
  (transports) => { /* verify JWT */ },
)

const apiKeyGuard = defineAuthGuard(
  { apiKey: { name: 'X-API-Key', in: 'header' } },
  (transports) => { /* verify API key */ },
)

@Controller('data')
export class DataController {
  // Requires BOTH JWT and API key
  @Authenticate(jwtGuard)
  @Authenticate(apiKeyGuard)
  @Get('admin')
  admin() { /* ... */ }

  // Requires JWT only
  @Authenticate(jwtGuard)
  @Post()
  create(@Body() dto: CreateDataDto) { /* ... */ }
}
```

::: warning Runtime vs docs
`@SwaggerSecurity` and `@SwaggerSecurityAll` only affect the OpenAPI spec — they do not add runtime guards. To enforce authentication, always use `@Authenticate()`. Use the swagger decorators when you need to override or fine-tune the generated security section (e.g. adding OAuth2 scopes).
:::
