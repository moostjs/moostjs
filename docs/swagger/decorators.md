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

## Common Moost metadata

`@moostjs/swagger` recognises several framework-level decorators from `moost`:

- `@Description()` – populates operation descriptions and serves as a fallback for schema descriptions when `SwaggerDescription` is not supplied.
- `@Label()` / `@Id()` – provide titles for component schemas generated from Atscript types.
- `@Optional()` / `@Required()` – participate in requirement flags when combined with Atscript optional fields.

By reusing these generic decorators you keep validation, documentation, and other modules aligned without duplicating annotations.
