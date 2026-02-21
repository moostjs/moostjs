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
- `@SwaggerResponse(opts)` / `@SwaggerResponse(code, opts)` — Define response schemas.
- `@SwaggerRequestBody(opts)` — Define request body schema.
- `@SwaggerParam(opts)` — Define a parameter.
- `@SwaggerExample(example)` — Attach an example value.
- `@SwaggerExclude()` — Exclude a controller or handler from the spec.

## [Official Documentation](https://moost.org/swagger/)

## License

MIT
