# Configuration

`SwaggerController` accepts an options object that controls the generated OpenAPI document and the serving behaviour. All fields are optional. The options object type is `TSwaggerOptions`, importable from `'@moostjs/swagger'`.

## Basic setup

```ts
import { createProvideRegistry } from 'moost'
import { SwaggerController } from '@moostjs/swagger'

const swagger = new SwaggerController({
  title: 'My API',
  description: 'REST API for the dashboard application',
  version: '2.1.0',
})

app.setProvideRegistry(
  createProvideRegistry([SwaggerController, () => swagger])
)
app.registerControllers(SwaggerController)
```

Without a provide registry, `SwaggerController` uses default values (`title: 'Moost API'`, `version: '1.0.0'`).

## Options reference

### Info fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `title` | `string` | `'API Documentation'` | API title shown in the Swagger UI header |
| `description` | `string` | — | Markdown-supported description |
| `version` | `string` | `'1.0.0'` | API version |
| `contact` | `{ name?, url?, email? }` | — | Contact information |
| `license` | `{ name, url? }` | — | License details |
| `termsOfService` | `string` | — | URL to terms of service |

::: info Title defaults
When you pass an options object without `title`, the generated spec falls back to `'API Documentation'`. When `SwaggerController` is registered without any options (no provide registry), its DI default kicks in and the title is `'Moost API'`.
:::

```ts
new SwaggerController({
  title: 'Billing API',
  version: '2025.1',
  contact: { name: 'Platform Team', email: 'platform@example.com' },
  license: { name: 'MIT', url: 'https://opensource.org/licenses/MIT' },
  termsOfService: 'https://example.com/tos',
})
```

### Servers

Define server URLs that appear in the Swagger UI "Servers" dropdown:

```ts
new SwaggerController({
  title: 'My API',
  servers: [
    { url: 'https://api.example.com', description: 'Production' },
    { url: 'https://staging.example.com', description: 'Staging' },
    { url: 'http://localhost:3000', description: 'Local' },
  ],
})
```

### Tags

Tags applied via `@SwaggerTag()` on endpoints are auto-collected into the top-level `tags` array. Pass `tags` in options to add descriptions or control display order:

```ts
new SwaggerController({
  title: 'My API',
  tags: [
    { name: 'Users', description: 'User management endpoints' },
    { name: 'Billing', description: 'Subscription and payment APIs' },
  ],
})
```

Manual tags appear first (preserving order), followed by any additional tags discovered on endpoints. If a tag name appears in both places, the manual entry wins — so you can provide descriptions for auto-discovered tags.

Tags can also link to external documentation:

```ts
tags: [
  {
    name: 'Users',
    description: 'User management',
    externalDocs: { url: 'https://wiki.example.com/users', description: 'User API guide' },
  },
]
```

### External documentation

Add a top-level external docs link to the spec:

```ts
new SwaggerController({
  title: 'My API',
  externalDocs: {
    url: 'https://wiki.example.com/api',
    description: 'Full API guide',
  },
})
```

This appears as a link in the Swagger UI header. For per-operation external docs, see [`@SwaggerExternalDocs`](/swagger/operations#external-documentation).

### OpenAPI version

By default the spec uses OpenAPI 3.0.0. Set `openapiVersion: '3.1'` to generate an OpenAPI 3.1.0 document:

```ts
new SwaggerController({
  title: 'My API',
  openapiVersion: '3.1',
})
```

The main difference: nullable types use `type: ['string', 'null']` (3.1) instead of `nullable: true` (3.0). The transformation is applied automatically.

### CORS

Enable CORS headers on all swagger endpoints (spec, UI assets):

```ts
// Allow any origin
new SwaggerController({ title: 'My API', cors: true })

// Allow a specific origin
new SwaggerController({ title: 'My API', cors: 'https://docs.example.com' })
```

This is useful when hosting the spec on a different domain from your documentation portal or SDK generator.

### Security schemes

Security schemes can be defined manually in options or auto-discovered from `@Authenticate()` guards. See the [Security](/swagger/security) page for details. Each entry is a `TSwaggerSecurityScheme` (exported union of `http`, `apiKey`, `oauth2`, and `openIdConnect` scheme shapes); the root `security` array contains `TSwaggerSecurityRequirement` objects (`Record<schemeName, scopes[]>`).

```ts
new SwaggerController({
  title: 'My API',
  securitySchemes: {
    oauth2: {
      type: 'oauth2',
      flows: {
        implicit: {
          authorizationUrl: 'https://auth.example.com/authorize',
          scopes: { 'read:users': 'Read users', 'write:users': 'Write users' },
        },
      },
    },
  },
  security: [{ oauth2: ['read:users'] }],
})
```

## Full example

```ts
import { createProvideRegistry, Moost } from 'moost'
import { MoostHttp } from '@moostjs/event-http'
import { SwaggerController } from '@moostjs/swagger'

const swagger = new SwaggerController({
  title: 'Acme API',
  description: 'Backend services for the Acme platform',
  version: '3.0.0',
  contact: { name: 'Backend Team', email: 'backend@acme.com' },
  license: { name: 'MIT' },
  servers: [
    { url: 'https://api.acme.com', description: 'Production' },
    { url: 'https://staging-api.acme.com', description: 'Staging' },
  ],
  tags: [
    { name: 'Users', description: 'User management' },
    { name: 'Products', description: 'Product catalog' },
    { name: 'Orders', description: 'Order processing' },
  ],
  externalDocs: { url: 'https://docs.acme.com', description: 'Developer portal' },
  openapiVersion: '3.1',
  cors: true,
})

const app = new Moost()
const http = new MoostHttp()
app.adapter(http)
app.setProvideRegistry(
  createProvideRegistry([SwaggerController, () => swagger])
)
app.registerControllers(
  SwaggerController,
  UsersController,
  ProductsController,
  OrdersController,
)
await app.init()
await http.listen(3000)
```

## Generating the spec without serving

If you just want the spec object (for SDK generation, CI validation, etc.), request `spec.json` programmatically through the HTTP adapter — no server needs to be listening:

```ts
await app.init()

const res = await http.request('/api-docs/spec.json')
const spec = await res!.json()

// Write to file, feed to openapi-generator, etc.
```

`MoostHttp.request()` invokes the route in-process, so this works in scripts and CI without binding a port. The returned object matches the OpenAPI 3.0 / 3.1 structure, built from the options passed to `SwaggerController`. Make sure `await app.init()` has run first — before init no controllers are bound.

Alternatively, call the spec generator directly with `mapToSwaggerSpec` — no `SwaggerController` registration needed:

```ts
import { mapToSwaggerSpec } from '@moostjs/swagger'
import type { TSwaggerOptions } from '@moostjs/swagger'

await app.init()

const options: TSwaggerOptions = { title: 'My API', version: '2.1.0' }
const spec = mapToSwaggerSpec(app.getControllersOverview(), options)
```

`mapToSwaggerSpec(metadata, options?)` takes the controllers overview from `app.getControllersOverview()` and the same `TSwaggerOptions` object that `SwaggerController` accepts, and returns the spec as a plain object.
