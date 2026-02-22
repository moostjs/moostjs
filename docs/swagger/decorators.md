# Swagger Decorators

`@moostjs/swagger` extends Moost’s mate system with a small set of decorators. Apply them directly to controllers or handlers to enrich the generated OpenAPI document. Parameters resolved through Moost decorators (`@Param`, `@Body`, `@Query`, `@Header`, …) are detected automatically; use these decorators only when you need extra metadata.

## Controller/handler-level decorators

| Decorator | Target | Purpose |
| --- | --- | --- |
| `SwaggerTag(tag: string)` | class/method | Adds a tag to the operation. Multiple tags can be applied. |
| `SwaggerDescription(text: string)` | method | Overrides the description specifically for Swagger. (The generic `@Description()` decorator from `moost` is picked up automatically.) |
| `SwaggerExclude()` | class/method | Excludes the controller/handler from the generated document. |

## Request & response metadata

| Decorator | Target | Purpose |
| --- | --- | --- |
| `SwaggerResponse(codeOrConfig, response?, example?)` | method | Describes responses. Accepts either a status code with configuration or a configuration object. Supports multiple content types. |
| `SwaggerRequestBody(config)` | method | Declares request body content when it cannot be inferred (multiple content types, raw payloads, etc.). |
| `SwaggerExample(example)` | method | Sets a reusable example on the inferred schema (typically the return type). |

### `SwaggerResponse`

Usage patterns:

```ts
// basic – infer schema from Atscript return type
@SwaggerResponse(200, CreateUserDto)

// with inline schema and example
@SwaggerResponse(400, {
  contentType: 'application/json',
  response: {
    type: 'object',
    properties: { message: { type: 'string' } },
    required: ['message'],
  },
  example: { message: 'Validation failed' },
})

// shorthand for `contentType: '*/*'`
@SwaggerResponse(404, String, 'Not found')
```

If the supplied value exposes `toJsonSchema()`, the generator stores it under `#/components/schemas/<Name>` and references it automatically.

#### Response descriptions

Every response object in the OpenAPI spec requires a `description` field. The generator fills it automatically using the standard HTTP reason phrase for the status code (e.g., `"OK"` for 200, `"Not Found"` for 404). To override the default, pass `description` in the config object:

```ts
@SwaggerResponse(409, {
  description: 'Username already taken',
  response: ConflictErrorDto,
})
```

This is most useful for non-obvious status codes where the standard phrase doesn't explain *when* the response occurs.

#### Return type inference

When no `@SwaggerResponse` is declared for the success status code (200 for GET, 201 for POST), the generator falls back to the method's TypeScript return type via `emitDecoratorMetadata`. If the return type exposes `toJsonSchema()` (e.g. an Atscript type), it will be used as the success response schema automatically:

```ts
@Get(':id')
@SwaggerResponse(404, String, 'User not found')
find(@Param('id') id: string): User {
  // 200 response schema inferred from `: User` return type
  // 404 response schema from @SwaggerResponse
}
```

::: warning TypeScript limitations
Return type inference relies on TypeScript's `emitDecoratorMetadata`, which has significant limitations:

- **Async methods** — `Promise<User>` emits as `Promise`, losing the generic parameter. The generator cannot extract `User` from it.
- **Type aliases** — `type Users = User[]` emits as `Array`. Only class types (including Atscript-generated classes) are preserved correctly.
- **Generics** — Any generic wrapper (`Observable<T>`, `Result<T>`, etc.) loses its type argument.
- **Transpiler differences** — SWC and tsc may handle edge cases differently (e.g. `class Users extends Array<User>` works with tsc but not SWC).

For reliable response documentation, especially with async handlers, **always use `@SwaggerResponse` explicitly**. Return type inference is a convenience for simple synchronous handlers with concrete class return types.
:::

### `SwaggerRequestBody`

Pass either an Atscript type or a raw JSON Schema wrapped in a config object:

```ts
@SwaggerRequestBody({
  contentType: 'application/json',
  response: CreateUserDto,
})

@SwaggerRequestBody({
  contentType: 'application/xml',
  response: {
    type: 'string',
  },
})
```

## Parameter metadata

| Decorator | Target | Purpose |
| --- | --- | --- |
| `SwaggerParam(opts)` | method | Registers an additional parameter (query, header, path, or formData). Use this only when the parameter is not resolved via standard Moost decorators. |

### Example

```ts
@SwaggerParam({
  name: 'expand',
  in: 'query',
  description: 'Optional relations to include',
  required: false,
  type: String,
})
async find(@Param('id') id: string, @Header('X-Trace') trace: string) {}
```

The schema passed via `type` can be a primitive (`String`, `'desc'`, `true`) or an Atscript type. When a parameter is resolved through `@Query`, `@Param`, `@Header`, or `@Body`, you typically **do not** need `SwaggerParam`; the mapper reads the metadata automatically.

## Working with examples and metadata

`SwaggerExample` and metadata from Moost mates (e.g., `@Label`, `@Description`) are merged. You can, for instance, set an example on an Atscript DTO and reuse it across multiple endpoints:

```ts
@SwaggerExample({ id: 'user_1', name: 'Alice' })
@SwaggerResponse(200, CreateUserDto)
async show(@Param('id') id: string) {}
```

The generated schema will include both the Atscript-derived structure and the example payload.

### Auto-generated examples via `toExampleData()`

If a type exposes a static `toExampleData()` method, the generator will call it automatically to populate the `example` field in the component schema. This works the same way as `toJsonSchema()` — pure duck typing with no import needed.

```ts
class CreateUserDto {
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

Atscript-generated types can implement `toExampleData()` using `@meta.example` annotations, making examples fully automatic. To enable this, set `exampleData: true` in your `atscript.config.ts`:

```ts
import { defineConfig } from '@atscript/core'
import tsPlugin from '@atscript/typescript'

export default defineConfig({
  entries: ['src/**/*.as'],
  plugins: [
    tsPlugin({
      jsonSchema: 'bundle', // or 'lazy'
      exampleData: true,    // enables toExampleData() on generated types
    }),
  ],
})
```

With this enabled, every `.as` type with `@meta.example` annotations will expose `toExampleData()`, and the swagger generator will pick it up automatically. See the [Atscript configuration docs](https://atscript.moost.org/packages/typescript/configuration#exampledata) for details.

Priority order for the `example` field:

1. `example` already present in the `toJsonSchema()` output
2. `@SwaggerExample` decorator
3. `toExampleData()` method (lowest priority, auto-generation fallback)

## Common Moost metadata

`@moostjs/swagger` recognises several framework-level decorators from `moost`:

- `@Description()` – populates operation descriptions and serves as a fallback for schema descriptions when `SwaggerDescription` is not supplied.
- `@Label()` / `@Id()` – provide titles for component schemas generated from Atscript types.
- `@Optional()` / `@Required()` – participate in requirement flags when combined with Atscript optional fields.

By reusing these generic decorators you keep validation, documentation, and other modules aligned without duplicating annotations.
