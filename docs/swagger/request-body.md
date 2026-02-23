# Request Body

The generator automatically documents request bodies from `@Body()` parameters. Use `@SwaggerRequestBody` when you need explicit control over the content type or schema.

## Auto-inference from `@Body()`

When a handler has a `@Body()` parameter, its type is used as the request body schema:

```ts
@Post()
create(@Body() dto: CreateUserDto) {
  // Request body documented as CreateUserDto (application/json)
}
```

The content type is selected automatically based on the parameter type:
- **Objects and arrays** → `application/json`
- **Primitives and strings** → `text/plain`

## Explicit request body

Use `@SwaggerRequestBody` when you need to specify the content type or override the inferred schema:

```ts
import { SwaggerRequestBody } from '@moostjs/swagger'

@SwaggerRequestBody({
  contentType: 'application/json',
  response: CreateUserDto,
})
@Post()
create(@Body() dto: CreateUserDto) { /* ... */ }
```

### Multiple content types

Call `@SwaggerRequestBody` multiple times to document alternative content types:

```ts
@SwaggerRequestBody({
  contentType: 'application/json',
  response: CreateUserDto,
})
@SwaggerRequestBody({
  contentType: 'application/xml',
  response: { type: 'string' },
})
@Post()
create(@Body() body: unknown) { /* ... */ }
```

### Inline JSON Schema

Pass a plain JSON Schema object instead of a type:

```ts
@SwaggerRequestBody({
  contentType: 'application/json',
  response: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      email: { type: 'string', format: 'email' },
    },
    required: ['name', 'email'],
  },
})
@Post()
create(@Body() body: unknown) { /* ... */ }
```

## Discriminated unions

When a type's `toJsonSchema()` includes `$defs` (for discriminated unions, nested types, etc.), the generator hoists them into `#/components/schemas/` and rewrites `$ref` paths automatically.

For example, an Atscript discriminated union:

```as
export interface Dog {
  petType: "dog"
  name: string
  breed: string
}

export interface Cat {
  petType: "cat"
  name: string
  indoor: boolean
}

export type Pet = Dog | Cat
```

`Pet.toJsonSchema()` produces `oneOf` with `$ref: '#/$defs/Dog'` and `$ref: '#/$defs/Cat'` plus a `discriminator` block. The generator transforms this into:

- `#/components/schemas/Pet` — `oneOf` with `$ref` entries pointing to component schemas, `discriminator.mapping` rewritten
- `#/components/schemas/Dog` — hoisted from `$defs`
- `#/components/schemas/Cat` — hoisted from `$defs`

This works at any nesting depth — array items, object properties, etc. — so `Pet[]` correctly references the same `Dog` and `Cat` component schemas. See [Schemas & Types](/swagger/schemas#defs-hoisting) for more details.

## Form data

For `multipart/form-data` uploads, use `@SwaggerRequestBody` with the appropriate content type:

```ts
@SwaggerRequestBody({
  contentType: 'multipart/form-data',
  response: {
    type: 'object',
    properties: {
      file: { type: 'string', format: 'binary' },
      description: { type: 'string' },
    },
  },
})
@Post('upload')
upload(@Body() body: unknown) { /* ... */ }
```
