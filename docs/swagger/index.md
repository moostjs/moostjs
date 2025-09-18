# Overview

`@moostjs/swagger` converts your Moost controllers into an OpenAPI 3 document and serves a Swagger UI. Once registered, it inspects Atscript-annotated DTOs, controller metadata, and standard argument resolvers (`@Query`, `@Header`, `@Body`, `@Param`) to produce accurate schemas with minimal configuration.

> Need a refresher on Atscript itself? Visit the official docs at [atscript.moost.org](https://atscript.moost.org/) for language syntax, CLI usage, and IDE tooling.

## Minimal example

```ts
import { Controller, Description, Optional } from 'moost'
import { Body, Get, Header, Param, Post, Query } from '@moostjs/event-http'
import { SwaggerController, SwaggerTag } from '@moostjs/swagger'
import { CreateUserDto } from './CreateUserDto.as'

@SwaggerTag('users')
@Controller('users')
export class UsersController {
  @Get(':id')
  @Description('Fetch a user by identifier')
  async find(
    @Param('id') id: string,
    @Query('expand') expand?: string,
    @Header('X-Trace') trace?: string
  ) {
    return { id, expand, trace }
  }

  @Post()
  async create(@Optional() @Body() dto: CreateUserDto) {
    return dto
  }
}
```

- `@Query`, `@Header`, and `@Body` are resolved by Moost, so they appear in the spec automatically.
- `@Description` is the common Moost decorator; Swagger reads it directly, so you rarely need `SwaggerDescription`.
- `CreateUserDto` comes from an Atscript `.as` file; the generator calls `toJsonSchema()` behind the scenes.
- Add optional decorators from `@moostjs/swagger` (e.g., `SwaggerResponse`, `SwaggerParam`) when you need extra metadata such as examples or alternative content types.

```ts
// CreateUserDto.as
@label "Create User"
export interface CreateUserDto {
  @label "Display name"
  name: string

  @expect.pattern "^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$", "u", "Invalid email"
  email: string

  @label "Password"
  password: string

  @labelOptional
  roles?: string[]
}
```

Any handler return type, `@Body()` payload, or `@Query()` DTO that points to an Atscript type like the one above automatically feeds the Swagger generator. Components are registered once and reused via `$ref`, so your documentation, validation, and DTOs stay in sync. See the [Atscript documentation](https://atscript.moost.org/) for authoring guidance and CLI tooling.

## Registering the controller

```ts
import { Moost } from 'moost'
import { MoostHttp } from '@moostjs/event-http'
import { SwaggerController } from '@moostjs/swagger'
import { createProvideRegistry } from '@prostojs/infact'

const swagger = new SwaggerController({
  title: 'My API',
  cors: true,
})

const app = new Moost()
app.adapter(new MoostHttp())
app.setProvideRegistry(createProvideRegistry([SwaggerController, () => swagger]))
app.registerControllers(UsersController, SwaggerController)
await app.init()
```

Navigate to <http://localhost:3000/api-docs> to see the UI. The controller caches the OpenAPI document (`spec.json`) to keep responses fast.

> Pro tip: the same Atscript DTOs can be validated at runtime using [`@atscript/moost-validator`](../validation/), ensuring documentation and validation stay in sync.

## Next steps

- [Swagger Decorators](/swagger/decorators)
- [Serving Swagger UI](/swagger/serving-ui)
