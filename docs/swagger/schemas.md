# Schemas & Types

The generator converts TypeScript types into JSON Schema components for the OpenAPI spec. Understanding the resolution pipeline helps you get the most out of automatic schema generation.

## Resolution pipeline

When the generator encounters a type (from `@SwaggerResponse`, `@Body()`, `@SwaggerRequestBody`, etc. — the accepted union is exported as `TSwaggerConfigType`), it resolves it through the following pipeline:

| Input | Result |
|-------|--------|
| Class with `static toJsonSchema()` | Named component in `#/components/schemas/` |
| Instance with `toJsonSchema()` | Named component |
| Plain object (`{ type: 'string', ... }`) | Inline JSON Schema |
| `String`, `Number`, `Boolean` | `{ type: 'string' }`, `{ type: 'number' }`, `{ type: 'boolean' }` |
| `Date` | `{ type: 'string', format: 'date-time' }` |
| `Array` | `{ type: 'array' }` |
| `Object` | `{ type: 'object' }` |
| `[SomeType]` (array literal) | `{ type: 'array', items: <resolved SomeType> }` |
| Literal string/number/boolean | `{ type, const: value }` |
| Zero-arg function | Invoked; the return value is resolved recursively |

::: info Type-name strings are a shorthand
The string literals `'string'`, `'number'`, `'boolean'`, `'integer'`, `'object'`, and `'array'` resolve to `{ type: <value> }` (a type shorthand) — not to a const literal. Any other string becomes `{ const: value, type: 'string' }`.
:::

## Atscript types

The recommended approach is to use [Atscript](https://atscript.moost.org/) `.as` files. The TypeScript plugin generates classes with `static toJsonSchema()`, so the swagger generator picks them up automatically:

```as
// types/User.as

@label "User"
export interface UserDto {
  @label "User ID"
  id: string

  @label "Display name"
  name: string

  @label "Email address"
  @expect.pattern "^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$", "u", "Invalid email"
  email: string

  @label "Roles"
  roles: string[]
}
```

This produces a `UserDto` class that the generator registers as `#/components/schemas/UserDto`. Everywhere you use `UserDto` — in responses, request bodies, parameters — it appears as `{ $ref: '#/components/schemas/UserDto' }`.

## Schema deduplication

The generator uses a `WeakMap` to track type references. The same class used in multiple places always produces a single component with multiple `$ref` pointers:

```ts
@SwaggerResponse(UserDto)        // → $ref: '#/components/schemas/UserDto'
@Get(':id')
find() { /* ... */ }

@SwaggerResponse([UserDto])      // → { type: 'array', items: { $ref: '#/components/schemas/UserDto' } }
@Get()
list() { /* ... */ }

@SwaggerResponse(201, UserDto)   // → same $ref, no duplicate
@Post()
create(@Body() dto: CreateUserDto) { /* ... */ }
```

When two different classes share the same name (e.g., `User` from different modules), the generator appends a numeric suffix: `User`, `User_1`, `User_2`.

## `$defs` hoisting

When a schema's `toJsonSchema()` output includes `$defs` (named sub-schemas referenced via `$ref: '#/$defs/Name'`), the generator automatically hoists them into `#/components/schemas/` and rewrites all `$ref` paths.

This commonly occurs with:
- **Discriminated unions** — Atscript unions with a discriminator property
- **Nested types** — Types that reference other named types internally
- **Recursive types** — Self-referencing schemas

Example: an Atscript discriminated union:

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

`Pet.toJsonSchema()` produces:

```json
{
  "oneOf": [
    { "$ref": "#/$defs/Dog" },
    { "$ref": "#/$defs/Cat" }
  ],
  "discriminator": {
    "propertyName": "petType",
    "mapping": { "dog": "#/$defs/Dog", "cat": "#/$defs/Cat" }
  },
  "$defs": {
    "Dog": { "type": "object", "properties": { ... } },
    "Cat": { "type": "object", "properties": { ... } }
  }
}
```

The generator transforms this into:

- `#/components/schemas/Pet` — `oneOf` with rewritten `$ref`s
- `#/components/schemas/Dog` — hoisted from `$defs`
- `#/components/schemas/Cat` — hoisted from `$defs`

Refs are rewritten at any nesting depth **within the root schema tree** — array items, object properties, `oneOf`/`allOf`/`anyOf` branches, `discriminator.mapping` — so `Pet[]` correctly references the same component schemas.

::: warning Sibling refs inside hoisted defs
Refs are not rewritten *inside* a hoisted definition: if `Dog` itself contained `$ref: '#/$defs/Cat'`, that ref would remain as a dangling `#/$defs/Cat` in the hoisted `Dog` component. Keep cross-references in the root schema tree, or pre-resolve them in your `toJsonSchema()` output.
:::

## Auto-generated examples

### `toExampleData()`

If a type exposes a static `toExampleData()` method, the generator calls it to populate the `example` field in the component schema:

```ts
class UserDto {
  static toJsonSchema() {
    return {
      type: 'object',
      properties: {
        name: { type: 'string' },
        email: { type: 'string', format: 'email' },
      },
      required: ['name', 'email'],
    }
  }

  static toExampleData() {
    return { name: 'Alice', email: 'alice@example.com' }
  }
}
```

### Atscript `@meta.example`

Atscript types can generate `toExampleData()` automatically from `@meta.example` annotations. Enable it in your Atscript config:

```ts
// atscript.config.ts
import { defineConfig } from '@atscript/core'
import tsPlugin from '@atscript/typescript'

export default defineConfig({
  entries: ['src/**/*.as'],
  plugins: [
    tsPlugin({
      jsonSchema: 'bundle',
      exampleData: true,
    }),
  ],
})
```

With this enabled, every `.as` type with `@meta.example` annotations exposes `toExampleData()`, and the generator picks it up automatically. See the [Atscript docs](https://atscript.moost.org/packages/typescript/configuration#exampledata) for details.

### Example priority

When multiple sources provide an example, this priority order applies:

1. `example` field already present in `toJsonSchema()` output (highest)
2. `@SwaggerExample` decorator on the DTO class
3. `toExampleData()` method (lowest — auto-generation fallback)

## Metadata on schemas

Moost core decorators on DTOs are reflected in the generated component schemas:

| Decorator | Schema field |
|-----------|-------------|
| `@Label('...')` | `title` |
| `@Description('...')` | `description` |
| `@Id('...')` | `title` (fallback) |

```ts
@Label('User')
@Description('Represents a registered user in the system')
class UserDto {
  static toJsonSchema() { /* ... */ }
}
```

Generated component:

```json
{
  "UserDto": {
    "title": "User",
    "description": "Represents a registered user in the system",
    "type": "object",
    "properties": { ... }
  }
}
```

## Array shorthand

Wrap a type in an array literal to create an array schema:

```ts
@SwaggerResponse([UserDto])
@Get()
list() {
  // Schema: { type: 'array', items: { $ref: '#/components/schemas/UserDto' } }
}
```

This works anywhere a type is accepted — responses, request bodies, parameters.

## Lazy resolution

Pass a zero-argument function to defer schema resolution:

```ts
@SwaggerResponse(() => UserDto)
@Get(':id')
find() { /* ... */ }
```

This is useful for avoiding circular import issues — the function is invoked at mapping time, after all modules are loaded.
