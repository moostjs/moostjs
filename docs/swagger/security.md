# Security Schemes

`@moostjs/swagger` auto-discovers authentication requirements from `@Authenticate()` guards and generates `components.securitySchemes` and per-operation `security` arrays in the OpenAPI spec.

## How it works

When you apply `@Authenticate(guard)` to a controller or handler, the decorator stores auth transport declarations in metadata. The swagger mapping engine reads these declarations and:

1. Generates the appropriate `securitySchemes` entries in `components`
2. Attaches `security` arrays to each operation

No manual swagger configuration is needed for standard auth patterns.

## Transport types

Four transport types are supported, each mapping to an OpenAPI security scheme:

| Transport | OpenAPI scheme | Scheme name |
| --- | --- | --- |
| `bearer` | `{ type: 'http', scheme: 'bearer', bearerFormat }` | `bearerAuth` |
| `basic` | `{ type: 'http', scheme: 'basic' }` | `basicAuth` |
| `apiKey` | `{ type: 'apiKey', name, in }` | `apiKeyAuth` |
| `cookie` | `{ type: 'apiKey', name, in: 'cookie' }` | `cookieAuth` |

## Example

```ts
import { Authenticate, defineAuthGuard } from '@moostjs/event-http'
import { SwaggerPublic } from '@moostjs/swagger'
import { Controller } from 'moost'

const jwtGuard = defineAuthGuard(
  { bearer: { format: 'JWT' } },
  (transports) => {
    // verify transports.bearer
  }
)

@Authenticate(jwtGuard)
@Controller('users')
export class UsersController {
  @SwaggerPublic()
  @Get()
  list() { /* public - no auth required */ }

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
    "/users/list": {
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

Marks a handler or controller as requiring no authentication in the docs. Emits `security: []` on affected operations.

```ts
@SwaggerPublic()
@Get()
publicEndpoint() { /* ... */ }
```

::: tip
`@SwaggerPublic()` only affects the swagger spec. It does not skip the auth guard at runtime. To skip the guard itself, you need a runtime check (e.g. checking metadata inside the guard).
:::

### `@SwaggerSecurity(schemeName, scopes?)`

Explicitly sets a security requirement, overriding auto-discovery. Useful for OAuth2 scopes or when the scheme name doesn't match the auto-generated one.

```ts
@SwaggerSecurity('oauth2', ['read:users', 'write:users'])
@Post()
create(@Body() dto: CreateUserDto) { /* ... */ }
```

### `@SwaggerSecurityAll(requirement)`

Sets a security requirement with AND semantics (multiple schemes required simultaneously).

```ts
@SwaggerSecurityAll({ bearerAuth: [], apiKeyAuth: [] })
@Get('admin')
adminOnly() { /* ... */ }
```

## Resolution precedence

When determining the `security` array for an operation, the following order is checked. The first match wins:

1. Handler `@SwaggerPublic()` &rarr; `security: []`
2. Handler `@SwaggerSecurity()` &rarr; handler's explicit requirement
3. Handler `@Authenticate()` &rarr; converted from transport declaration
4. Controller `@SwaggerPublic()` &rarr; `security: []`
5. Controller `@SwaggerSecurity()` &rarr; controller's explicit requirement
6. Controller `@Authenticate()` &rarr; converted from transport declaration
7. None &rarr; `security` omitted (inherits global default if set)

Handler-level decorators always take priority over controller-level ones.

## Global security via options

You can set a global default security requirement and manually define security schemes through `SwaggerController` options:

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
