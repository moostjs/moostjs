# Responses

`@SwaggerResponse` documents what an endpoint returns — the status code, schema, content type, headers, and examples. This is the decorator you'll use most often.

## Basic usage

Pass a type or configuration object. When no status code is given, the generator uses the default for the HTTP method:

| HTTP method | Default status |
|-------------|----------------|
| GET, PUT | 200 |
| POST | 201 |
| DELETE | 204 |

```ts
// Type shorthand — uses the method's default status code
@SwaggerResponse(UserDto)
@Get(':id')
find(@Param('id') id: string) { /* 200 response with UserDto schema */ }

// Explicit status code
@SwaggerResponse(201, UserDto)
@Post()
create(@Body() dto: CreateUserDto) { /* 201 response with UserDto schema */ }

// Error response
@SwaggerResponse(404, ErrorDto)
@Get(':id')
find(@Param('id') id: string) { /* 404 response with ErrorDto schema */ }
```

Multiple `@SwaggerResponse` decorators on the same handler combine into the operation's full response set:

```ts
@SwaggerResponse(UserDto)
@SwaggerResponse(404, ErrorDto)
@SwaggerResponse(403, ErrorDto)
@Get(':id')
find(@Param('id') id: string) { /* 200, 404, and 403 documented */ }
```

## Response descriptions

The OpenAPI spec requires a `description` for each response. The generator fills it automatically using HTTP reason phrases (`200` → `"OK"`, `404` → `"Not Found"`). Override with the `description` field:

```ts
@SwaggerResponse(409, {
  description: 'Username already taken',
  response: ConflictErrorDto,
})
@Post()
create(@Body() dto: CreateUserDto) { /* ... */ }
```

This is most useful for non-obvious status codes where the standard phrase doesn't explain _when_ the response occurs.

## Content types

By default, responses use `*/*` as the content type. Specify a content type explicitly:

```ts
@SwaggerResponse(200, {
  contentType: 'application/json',
  response: UserDto,
})
```

Multiple `@SwaggerResponse` calls with the same status code but different `contentType` values are merged into a single response with multiple media types:

```ts
@SwaggerResponse(200, { contentType: 'application/json', response: UserDto })
@SwaggerResponse(200, { contentType: 'application/xml', response: { type: 'string' } })
@Get(':id')
find(@Param('id') id: string) { /* 200 with JSON and XML variants */ }
```

## Response headers

Document response headers (pagination, rate-limiting, etc.) with the `headers` field:

```ts
@SwaggerResponse(200, {
  response: UsersListDto,
  headers: {
    'X-Total-Count': {
      type: Number,
      description: 'Total number of items',
      required: true,
    },
    'X-Rate-Limit': {
      type: Number,
      description: 'Requests remaining in current window',
      example: 100,
    },
  },
})
@Get()
list() { /* ... */ }
```

Each header entry supports:

| Field | Type | Description |
|-------|------|-------------|
| `type` | type/schema | Schema for the header value (primitives, Atscript types, inline JSON Schema) |
| `description` | `string` | Human-readable description |
| `required` | `boolean` | Whether the header is always present |
| `example` | any | Example value |

## Examples

Examples can be attached in several ways. The priority order (highest first):

1. **Inline in `toJsonSchema()` output** — `example` field in the schema itself
2. **`@SwaggerExample` decorator** — explicit example on the handler
3. **`toExampleData()` method** — auto-generated from the type

### Positional argument

Pass the example as a third argument:

```ts
@SwaggerResponse(200, UserDto, { id: '1', name: 'Alice', email: 'alice@example.com' })
@Get(':id')
find(@Param('id') id: string) { /* ... */ }
```

### Config object

Include `example` in the configuration:

```ts
@SwaggerResponse(200, {
  response: UserDto,
  example: { id: '1', name: 'Alice', email: 'alice@example.com' },
})
```

### `@SwaggerExample` decorator

Attach an example to the handler's default response:

```ts
@SwaggerExample({ id: '1', name: 'Alice', email: 'alice@example.com' })
@SwaggerResponse(UserDto)
@Get(':id')
find(@Param('id') id: string) { /* ... */ }
```

### Auto-generated via `toExampleData()`

If a type exposes a static `toExampleData()` method, the generator calls it automatically:

```ts
class UserDto {
  static toJsonSchema() {
    return { type: 'object', properties: { name: { type: 'string' } } }
  }

  static toExampleData() {
    return { name: 'Alice' }
  }
}
```

Atscript types can generate `toExampleData()` automatically from `@meta.example` annotations. See [Schemas & Types](/swagger/schemas#auto-generated-examples) for details.

## Return type inference

When no `@SwaggerResponse` is declared for the success status code, the generator falls back to the method's return type (via TypeScript's `emitDecoratorMetadata`). This works for simple cases:

```ts
@Get(':id')
find(@Param('id') id: string): UserDto {
  // 200 response schema inferred from `: UserDto` return type
}
```

::: warning TypeScript limitations
Return type inference relies on `emitDecoratorMetadata`, which has significant limitations:

- **Async methods** — `Promise<UserDto>` emits as `Promise`, losing the generic parameter.
- **Type aliases** — `type Users = User[]` emits as `Array`, losing the element type.
- **Generics** — Any generic wrapper (`Observable<T>`, `Result<T>`, etc.) loses its type argument.

For reliable response documentation, especially with async handlers, **always use `@SwaggerResponse` explicitly**.
:::
