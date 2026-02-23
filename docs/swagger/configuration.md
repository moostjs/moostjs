# Configuration

`SwaggerController` accepts an options object that controls the generated OpenAPI document and the serving behaviour. All fields are optional.

## Basic setup

```ts
import { SwaggerController } from '@moostjs/swagger'
import { createProvideRegistry } from '@prostojs/infact'

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
| `title` | `string` | `'Moost API'` | API title shown in the Swagger UI header |
| `description` | `string` | — | Markdown-supported description |
| `version` | `string` | `'1.0.0'` | API version |
| `contact` | `{ name?, url?, email? }` | — | Contact information |
| `license` | `{ name, url? }` | — | License details |
| `termsOfService` | `string` | — | URL to terms of service |

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

Security schemes can be defined manually in options or auto-discovered from `@Authenticate()` guards. See the [Security](/swagger/security) page for details.

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
import { Moost } from 'moost'
import { MoostHttp } from '@moostjs/event-http'
import { SwaggerController } from '@moostjs/swagger'
import { createProvideRegistry } from '@prostojs/infact'

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
app.adapter(new MoostHttp())
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
```

## Using `mapToSwaggerSpec()` directly

If you don't need the UI and just want the spec object (for SDK generation, CI validation, etc.), call `mapToSwaggerSpec()` directly:

```ts
import { mapToSwaggerSpec } from '@moostjs/swagger'

const spec = mapToSwaggerSpec(app.getControllersOverview(), {
  title: 'My API',
  version: '2.0.0',
})

// Write to file, feed to openapi-generator, etc.
```

The function accepts the same options as `SwaggerController` and returns a plain object matching the OpenAPI 3.0 / 3.1 structure.
