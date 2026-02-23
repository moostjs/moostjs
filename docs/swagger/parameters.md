# Parameters

The generator automatically creates OpenAPI parameters from Moost's argument resolvers. You rarely need to add swagger-specific annotations for parameters.

## Auto-inference

Parameters are detected from standard Moost decorators:

| Decorator | OpenAPI `in` | Notes |
|-----------|-------------|-------|
| `@Param('name')` | `path` | Always `required: true`, type from metadata |
| `@Query('name')` | `query` | Optional by default, type from metadata |
| `@Header('name')` | `header` | Type from metadata |

```ts
@Get(':id')
find(
  @Param('id') id: string,
  @Query('expand') expand?: string,
  @Header('X-Request-Id') requestId?: string,
) { /* all three appear in the spec automatically */ }
```

The schema for each parameter is resolved from its TypeScript type. Primitives (`string`, `number`, `boolean`) map directly to JSON Schema types. Atscript types and classes with `toJsonSchema()` are resolved through the [schema pipeline](/swagger/schemas).

## Path parameters

Path parameters extracted from the route pattern (`:id`, `:slug`, etc.) are always marked as `required: true`:

```ts
@Get(':userId/posts/:postId')
findPost(
  @Param('userId') userId: string,
  @Param('postId') postId: number,
) { /* both required path params */ }
```

## Query parameters

### Simple types

A query parameter with a primitive type creates a single parameter:

```ts
@Get()
list(
  @Query('page') page?: number,
  @Query('limit') limit?: number,
  @Query('search') search?: string,
) { /* three query params */ }
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

### Array parameters

Array-typed query params use the `explode` style (`?tag=a&tag=b`):

```ts
@Get()
list(@Query('tag') tags: string[]) {
  // query param "tag" with schema { type: 'array', items: { type: 'string' } }
}
```

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
| `in` | `'query' \| 'header' \| 'path' \| 'formData'` | Parameter location |
| `description` | `string` | Human-readable description |
| `required` | `boolean` | Whether the parameter is required |
| `type` | type/schema | Schema for the parameter value |

The `type` field accepts the same values as response schemas — primitives (`String`, `Number`), Atscript types, or inline JSON Schema objects.

### When to use `@SwaggerParam`

Use it for parameters that the generator can't infer automatically:
- Headers that aren't read via `@Header()`
- Query parameters added by middleware
- Cookie parameters
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
list(@Query('page') page?: number) {
  // "page" auto-inferred, "sort" and "X-Trace-Id" from @SwaggerParam
}
```
