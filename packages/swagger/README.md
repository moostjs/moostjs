# @moostjs/swagger

Swagger/OpenAPI integration for [Moost](https://moost.org). Automatically generates an OpenAPI spec from your controllers and serves the Swagger UI. Provides decorators for adding tags, descriptions, response schemas, and request body definitions.

## Installation

```bash
npm install @moostjs/swagger swagger-ui-dist
```

## Quick Start

```ts
import { Moost } from 'moost'
import { MoostHttp } from '@moostjs/event-http'
import { SwaggerController } from '@moostjs/swagger'

const app = new Moost()
const http = new MoostHttp()

app
  .adapter(http)
  .controllers(SwaggerController)
  .init()

http.listen(3000)
// Swagger UI available at http://localhost:3000/api-docs/
```

## Decorators

- `@SwaggerTag(tag)` — Add an OpenAPI tag to a controller or handler.
- `@SwaggerDescription(text)` — Set a description for a handler.
- `@SwaggerResponse(opts)` / `@SwaggerResponse(code, opts)` — Define response schemas. Supports optional `description` to document the status code; when omitted, a standard HTTP reason phrase is used automatically.
- `@SwaggerRequestBody(opts)` — Define request body schema.
- `@SwaggerParam(opts)` — Define a parameter.
- `@SwaggerExample(example)` — Attach an example value.
- `@SwaggerExclude()` — Exclude a controller or handler from the spec.
- `@SwaggerPublic()` — Mark an endpoint or controller as public (no auth required in docs).
- `@SwaggerSecurity(schemeName, scopes?)` — Explicitly set a security requirement.
- `@SwaggerSecurityAll(requirement)` — Set security with AND semantics.

## Return Type Inference

When no `@SwaggerResponse` is declared for the success status code, the generator falls back to the method's return type (via `emitDecoratorMetadata`). This works for simple class types like Atscript-generated DTOs but has limitations: `Promise<T>`, type aliases (`type X = Y[]`), and other generics lose their type arguments at emit time. For reliable response documentation — especially with async handlers — always use `@SwaggerResponse` explicitly.

## Security Schemes

Security schemes are auto-discovered from `@Authenticate()` guards (provided by `@moostjs/event-http`). All four OpenAPI transport types are supported: bearer, basic, apiKey, and cookie.

```ts
import { Authenticate, defineAuthGuard } from '@moostjs/event-http'
import { SwaggerPublic } from '@moostjs/swagger'

const jwtGuard = defineAuthGuard({ bearer: { format: 'JWT' } }, (transports) => {
  // verify transports.bearer token
})

@Authenticate(jwtGuard)
@Controller('users')
class UsersController {
  @SwaggerPublic()  // overrides controller auth for this endpoint
  @Get()
  list() { ... }

  @Get(':id')
  find(@Param('id') id: string) { ... }  // inherits bearer auth from controller
}
```

The generated spec will include `components.securitySchemes` with the auto-discovered schemes and per-operation `security` arrays. Use `@SwaggerPublic()` to mark endpoints as public or `@SwaggerSecurity()` for explicit overrides.

## [Official Documentation](https://moost.org/swagger/)

## License

MIT
