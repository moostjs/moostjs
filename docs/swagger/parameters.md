# Parameters

The generator automatically creates OpenAPI parameters from Moost's argument resolvers. You rarely need to add swagger-specific annotations for path and query parameters.

## Auto-inference

Parameters are detected from standard Moost decorators:

| Decorator | OpenAPI `in` | Notes |
|-----------|-------------|-------|
| `@Param('name')` | `path` | `required: true` unless `@Optional()` is applied, type from metadata |
| `@Query('name')` | `query` | `required: true` unless `@Optional()` is applied, type from metadata |

```ts
import { Optional, Param } from 'moost'
import { Get, Query } from '@moostjs/event-http'

@Get(':id')
find(
  @Param('id') id: string,
  @Optional() @Query('expand') expand?: string,
) { /* both appear in the spec automatically */ }
```

The schema for each parameter is resolved from its TypeScript type. Primitives (`string`, `number`, `boolean`) map directly to JSON Schema types. Atscript types and classes with `toJsonSchema()` are resolved through the [schema pipeline](/swagger/schemas).

::: warning Required by default — and `?` doesn't help
Query parameters are emitted with `required: true` unless the argument is decorated with `@Optional()` (from `moost`). The TypeScript `?` modifier is **not** reflected into metadata and has no effect on the spec.
:::

::: warning Headers are never auto-inferred
`@Header('name')` resolves the value at runtime, but it leaves no parameter metadata for the generator — header parameters never appear in the spec automatically. Declare them with [`@SwaggerParam({ in: 'header', ... })`](#manual-parameters-with-swaggerparam).
:::

## Path parameters

Path parameters extracted from the route pattern (`:id`, `:slug`, etc.) are marked as `required: true`:

```ts
@Get(':userId/posts/:postId')
findPost(
  @Param('userId') userId: string,
  @Param('postId') postId: number,
) { /* both required path params */ }
```

Applying `@Optional()` to a `@Param()` argument emits `required: false` — avoid this for path parameters, since OpenAPI requires them to be `required: true`.

## Query parameters

### Simple types

A query parameter with a primitive type creates a single parameter:

```ts
@Get()
list(
  @Optional() @Query('page') page?: number,
  @Optional() @Query('limit') limit?: number,
  @Optional() @Query('search') search?: string,
) { /* three optional query params */ }
```

### Object expansion

When `@Query()` receives an object type (without a specific key), each property becomes a separate query parameter:

```ts
class ListFilters {
  static toJsonSchema() {
    return {
      type: 'object',
      properties: {
        page: { type: 'number' },
        limit: { type: 'number' },
        role: { type: 'string' },
      },
    }
  }
}

@Get()
list(@Query() filters: ListFilters) {
  // Generates three query params: page, limit, role
}
```

This is useful for grouping related filters into a single DTO.

::: warning Object expansion gotchas
- Properties whose schema is not a simple type (string/number/integer/boolean, enum, const, or an array of those) are **silently dropped** from the spec. Declare such params manually with `@SwaggerParam` if you need them documented.
- Per-property `required` flags come from the object schema's `required` array (combined with `@Optional()` on the argument) — not from TypeScript optionality.
:::

### Array parameters

To document an array-valued query param (`?tag=a&tag=b`), the parameter's schema must carry typed items. A plain `string[]` TypeScript annotation reflects only as `Array` — the item type is lost and the generator falls back to `{ type: 'string' }`. Provide an explicit schema instead:

```ts
@SwaggerParam({
  name: 'tag',
  in: 'query',
  type: { type: 'array', items: { type: 'string' } },
})
@Get()
list(@Query('tag') tags: string[]) {
  // query param "tag" with schema { type: 'array', items: { type: 'string' } }
}
```

A `toJsonSchema()`-backed type (e.g. an Atscript DTO property) with array items of simple types works too. The generator does not set `style`/`explode` — OpenAPI's defaults for query arrays (`form` + `explode: true`, i.e. `?tag=a&tag=b`) apply.

## Manual parameters with `@SwaggerParam`

When a parameter isn't resolved through standard Moost decorators, use `@SwaggerParam` to declare it manually:

```ts
import { SwaggerParam } from '@moostjs/swagger'

@SwaggerParam({
  name: 'X-Api-Version',
  in: 'header',
  description: 'API version override',
  required: false,
  type: String,
})
@Get()
list() { /* ... */ }
```

### Options

| Field | Type | Description |
|-------|------|-------------|
| `name` | `string` | Parameter name |
| `in` | `'query' \| 'header' \| 'path' \| 'formData' \| 'body'` | Parameter location (`'cookie'` is not supported) |
| `description` | `string` | Human-readable description |
| `required` | `boolean` | Whether the parameter is required |
| `type` | type/schema | Schema for the parameter value |

The `type` field accepts the same values as response schemas — primitives (`String`, `Number`), Atscript types, or inline JSON Schema objects.

### When to use `@SwaggerParam`

Use it for parameters that the generator can't infer automatically:
- Header parameters (never auto-inferred — see above)
- Query parameters added by middleware
- Array-valued query parameters (see [Array parameters](#array-parameters))
- Parameters with specific descriptions or constraints not expressed in the type

```ts
@SwaggerParam({
  name: 'sort',
  in: 'query',
  description: 'Sort field and direction (e.g., "name:asc")',
  required: false,
  type: String,
})
@SwaggerParam({
  name: 'X-Trace-Id',
  in: 'header',
  description: 'Distributed tracing identifier',
  required: false,
  type: String,
})
@Get()
list(@Optional() @Query('page') page?: number) {
  // "page" auto-inferred, "sort" and "X-Trace-Id" from @SwaggerParam
}
```
