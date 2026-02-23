# @moostjs/swagger

`@moostjs/swagger` generates an [OpenAPI 3](https://spec.openapis.org/oas/v3.0.3) document from your Moost controllers and serves a Swagger UI. It reads controller metadata, argument resolvers (`@Param`, `@Query`, `@Header`, `@Body`), and Atscript-annotated DTOs to produce accurate schemas with minimal manual annotation.

## Installation

```bash
npm install @moostjs/swagger swagger-ui-dist
```

`swagger-ui-dist` provides the static UI assets. It is a peer dependency — install it alongside the main package.

## Quick start

Register `SwaggerController` like any other Moost controller:

```ts
import { Moost } from 'moost'
import { MoostHttp } from '@moostjs/event-http'
import { SwaggerController } from '@moostjs/swagger'

const app = new Moost()
app.adapter(new MoostHttp())
app.registerControllers(SwaggerController)
await app.init()
```

Open <http://localhost:3000/api-docs> to see the Swagger UI. The JSON spec is available at `/api-docs/spec.json` and YAML at `/api-docs/spec.yaml`.

### Adding a controller

```ts
import { Controller, Description } from 'moost'
import { Body, Get, Param, Post, Query } from '@moostjs/event-http'
import { SwaggerTag } from '@moostjs/swagger'
import { CreateUserDto, UserDto } from './types/User.as'

@SwaggerTag('Users')
@Controller('users')
export class UsersController {
  @Get(':id')
  @Description('Fetch a user by ID')
  find(@Param('id') id: string, @Query('expand') expand?: string): UserDto {
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

```
Decorators & metadata   ──>   mapToSwaggerSpec()   ──>   OpenAPI 3.0/3.1 JSON
  @Controller, @Get,                                        served by
  @Body, @Query,           reads controller overview,       SwaggerController
  @SwaggerTag, ...         resolves schemas, builds         at /api-docs/
                           paths + components
```

1. **Metadata collection** — Moost decorators and `@moostjs/swagger` decorators store metadata on controllers and handlers via the `Mate` system.
2. **Spec mapping** — `mapToSwaggerSpec()` iterates all registered controllers, resolves types to JSON Schema, and builds the OpenAPI document.
3. **Serving** — `SwaggerController` caches the spec and serves it alongside the Swagger UI assets.

## What to read next

| Page | What you'll learn |
|------|-------------------|
| [Configuration](/swagger/configuration) | Customize title, version, servers, tags, OpenAPI version, and CORS |
| [Operations](/swagger/operations) | Tags, descriptions, operationId, deprecated, and external docs |
| [Responses](/swagger/responses) | Status codes, content types, headers, examples, and return type inference |
| [Request Body](/swagger/request-body) | Body schemas, content types, and discriminated unions |
| [Parameters](/swagger/parameters) | Path, query, and header params — auto-inferred and manual |
| [Schemas & Types](/swagger/schemas) | How types become JSON Schema components |
| [Security](/swagger/security) | Auth scheme auto-discovery and security decorators |
| [Links & Callbacks](/swagger/links-callbacks) | Response links and webhook documentation |
| [Serving the UI](/swagger/serving-ui) | Endpoints, mount path, YAML, and programmatic access |
