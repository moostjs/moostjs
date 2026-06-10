# Operations

Operation-level decorators control how individual endpoints appear in the generated spec and Swagger UI. Most are optional — the generator produces reasonable defaults from your controller and handler metadata.

## Tags

`@SwaggerTag` groups endpoints in the Swagger UI sidebar. Apply it to a controller (affects all handlers) or individual methods:

```ts
@SwaggerTag('Users')
@Controller('users')
export class UsersController {
  @Get()
  list() { /* tagged "Users" */ }

  @SwaggerTag('Admin')
  @Delete(':id')
  remove(@Param('id') id: string) { /* tagged "Users" and "Admin" */ }
}
```

Multiple `@SwaggerTag` decorators stack — an endpoint can belong to several groups.

Tags are auto-collected into the top-level `tags` array. To add descriptions or control the display order, provide `tags` in the [configuration options](/swagger/configuration#tags).

## Descriptions and summaries

Two levels of text are available for each operation:

| Moost decorator | OpenAPI field | Where it appears |
|----------------|---------------|------------------|
| `@Label('...')` | `summary` | Short one-liner next to the endpoint path |
| `@Description('...')` | `description` | Expanded text below the summary (supports markdown) |

```ts
@Label('List all users')
@Description('Returns a paginated list of users. Supports filtering by role and status.')
@Get()
list(@Query('role') role?: string) { /* ... */ }
```

Both are standard Moost decorators — no swagger-specific import needed. If you need the swagger description to differ from the core one, use `@SwaggerDescription()` which takes priority.

## Operation ID

The `operationId` is resolved in this order: `@SwaggerOperationId()` → `@Id()` → an auto-generated value. The auto-generated value has the form `{METHOD}_{sanitized_path}` — the uppercase HTTP method joined to the route path with non-alphanumeric characters replaced by underscores (`/` → `_`, `{`/`}` → `__`, any other → `_`). For example, `GET /users` generates `GET__users` and `GET /users/{id}` generates `GET__users___id__`. Override it with:

```ts
// Swagger-specific override (highest priority)
@SwaggerOperationId('listUsers')
@Get()
list() { /* operationId: "listUsers" */ }

// Or use the core @Id decorator (fallback)
@Id('listUsers')
@Get()
list() { /* operationId: "listUsers" */ }
```

`@SwaggerOperationId` takes priority over `@Id()`, which takes priority over the auto-generated value. Operation IDs must be unique across the entire spec.

## Deprecated

Mark endpoints as deprecated in the spec. Swagger UI renders these with a strikethrough:

```ts
@SwaggerDeprecated()
@Get('v1/users')
listV1() { /* deprecated */ }
```

Applied to a controller, it marks all its handlers as deprecated:

```ts
@SwaggerDeprecated()
@Controller('v1')
export class V1Controller {
  @Get('users')
  list() { /* deprecated */ }

  @Get('products')
  products() { /* deprecated */ }
}
```

## Excluding endpoints

Hide a controller or handler from the generated spec entirely:

```ts
@SwaggerExclude()
@Controller('internal')
export class InternalController {
  @Get('health')
  health() { /* not in spec */ }
}
```

```ts
@Controller('users')
export class UsersController {
  @Get()
  list() { /* in spec */ }

  @SwaggerExclude()
  @Get('debug')
  debug() { /* not in spec */ }
}
```

::: tip
`SwaggerController` itself is decorated with `@SwaggerExclude()`, so the `/api-docs` endpoints never appear in the generated spec.
:::

## External documentation

Link an operation to external docs (wiki pages, design documents, etc.):

```ts
@SwaggerExternalDocs('https://wiki.example.com/users/search', 'Search query syntax')
@Get('search')
search(@Query('q') q: string) { /* ... */ }
```

External docs are also supported at the [spec level and tag level](/swagger/configuration#external-documentation) via configuration options.

## Moost metadata integration

The generator recognizes several framework-level decorators from `moost`, so you rarely need swagger-specific annotations for basic metadata:

| Moost decorator | Swagger effect |
|----------------|----------------|
| `@Label()` | Operation `summary` and schema `title` |
| `@Description()` | Operation `description` and schema `description` |
| `@Id()` | Fallback for `operationId` |
| `@Optional()` | Clears the `required` flag on parameters and the request body (params are required by default; `@Required()` has no swagger effect) |

By reusing these generic decorators, your validation, documentation, and other modules stay aligned without duplicating annotations.

## Custom decorators with `getSwaggerMate()`

All swagger decorators write structured metadata (the `TSwaggerMate` shape) that the generator reads back at mapping time. The exported `getSwaggerMate()` returns the shared metadata instance, so you can compose your own project-wide decorators that fill the same fields — they are picked up by the generator automatically:

```ts
import { getSwaggerMate } from '@moostjs/swagger'

// Equivalent of @SwaggerTag('Admin') + @SwaggerDeprecated()
export const AdminLegacy = () =>
  getSwaggerMate().apply(
    getSwaggerMate().decorate('swaggerTags', 'Admin', true),
    getSwaggerMate().decorate('swaggerDeprecated', true),
  )
```
