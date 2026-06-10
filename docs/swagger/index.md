# @moostjs/swagger

`@moostjs/swagger` generates an [OpenAPI 3](https://spec.openapis.org/oas/v3.0.3) document from your Moost controllers and serves a Swagger UI. It reads controller metadata, argument resolvers (`@Param`, `@Query`, `@Body`), and Atscript-annotated DTOs to produce accurate schemas with minimal manual annotation. Both OpenAPI 3.0 and 3.1 are supported — select the version via `openapiVersion` (see [Configuration](/swagger/configuration#openapi-version)).

## Installation

```bash
npm install @moostjs/swagger
```

The static UI assets ship with the package (`swagger-ui-dist` is a regular dependency — no separate install needed). The package expects `moost`, `@moostjs/event-http`, and `@wooksjs/http-static` as peer dependencies; modern package managers install them automatically.

## Quick start

Register `SwaggerController` like any other Moost controller:

```ts
import { Moost } from 'moost'
import { MoostHttp } from '@moostjs/event-http'
import { SwaggerController } from '@moostjs/swagger'

const app = new Moost()
const http = new MoostHttp()
app.adapter(http)
app.registerControllers(SwaggerController)
await app.init()
await http.listen(3000)
```

Open <http://localhost:3000/api-docs> to see the Swagger UI. The JSON spec is available at `/api-docs/spec.json` and YAML at `/api-docs/spec.yaml`.

### Adding a controller

```ts
import { Controller, Description, Optional, Param } from 'moost'
import { Body, Get, Post, Query } from '@moostjs/event-http'
import { SwaggerTag } from '@moostjs/swagger'
import { CreateUserDto, UserDto } from './types/User.as'

@SwaggerTag('Users')
@Controller('users')
export class UsersController {
  @Get(':id')
  @Description('Fetch a user by ID')
  find(@Param('id') id: string, @Optional() @Query('expand') expand?: string): UserDto {
    // ...
  }

  @Post()
  create(@Body() dto: CreateUserDto): UserDto {
    // ...
  }
}
```

The generator automatically detects:
- **Path parameters** from `@Param('id')` and the `:id` route segment
- **Query parameters** from `@Query('expand')`
- **Request body** from `@Body()` with the `CreateUserDto` type
- **Response schemas** from return types (when using Atscript types with `toJsonSchema()`)

### Atscript DTOs

Atscript `.as` files provide type-safe schemas that the generator reads via `toJsonSchema()`:

```as
// types/User.as

@label "Create User"
export interface CreateUserDto {
  @label "Display name"
  name: string

  @expect.pattern "^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$", "u", "Invalid email"
  email: string

  roles?: string[]
}

@label "User"
export interface UserDto {
  id: string
  name: string
  email: string
  roles: string[]
}
```

Types are registered as named components in `#/components/schemas/` and reused via `$ref` throughout the spec. Types that expose `toExampleData()` have their examples populated automatically.

> Visit [atscript.moost.org](https://atscript.moost.org/) for full Atscript syntax, CLI usage, and IDE tooling.

## How it works

The decorators you already use (`@Controller`, `@Get`, `@Body`, `@Query`, `@SwaggerTag`, …) carry all the information needed to build the spec. What this means in practice:

- The spec covers every controller registered on the app at the time of the first request to `/api-docs/spec.json` — it is generated lazily on that first request and **cached**; controllers added after that are not reflected.
- Types are resolved to JSON Schema components — see [Schemas & Types](/swagger/schemas).
- `SwaggerController` serves the cached spec alongside the Swagger UI assets.
- You can also generate the spec programmatically with `mapToSwaggerSpec(app.getControllersOverview(), options)` (exported from `@moostjs/swagger`) — see [Generating the spec without serving](/swagger/configuration#generating-the-spec-without-serving).

## What to read next

| Page | What you'll learn |
|------|-------------------|
| [Configuration](/swagger/configuration) | Customize title, version, servers, tags, OpenAPI version, and CORS |
| [Operations](/swagger/operations) | Tags, descriptions, operationId, deprecated, and external docs |
| [Responses](/swagger/responses) | Status codes, content types, headers, examples, and return type inference |
| [Request Body](/swagger/request-body) | Body schemas, content types, and discriminated unions |
| [Parameters](/swagger/parameters) | Path and query params (auto-inferred), header params (manual via `@SwaggerParam`) |
| [Schemas & Types](/swagger/schemas) | How types become JSON Schema components |
| [Security](/swagger/security) | Auth scheme auto-discovery and security decorators |
| [Links & Callbacks](/swagger/links-callbacks) | Response links and webhook documentation |
| [Serving the UI](/swagger/serving-ui) | Endpoints, mount path, YAML, and programmatic access |
