# Serving the UI

`@moostjs/swagger` ships with a controller that serves both the generated OpenAPI document and the Swagger UI bundle. Once registered, the following endpoints become available.

## Endpoints

Default base path: `/api-docs`

| Endpoint | Description |
|----------|-------------|
| `/api-docs` | HTML page that bootstraps Swagger UI |
| `/api-docs/spec.json` | Cached OpenAPI 3 document (JSON) |
| `/api-docs/spec.yaml` | Cached OpenAPI 3 document (YAML) |
| `/api-docs/swagger-ui-*.{js,css}` | Static assets from `swagger-ui-dist` |

## Basic setup

```ts
import { Moost } from 'moost'
import { MoostHttp } from '@moostjs/event-http'
import { SwaggerController } from '@moostjs/swagger'

const app = new Moost()
app.adapter(new MoostHttp())
app.registerControllers(SwaggerController)
await app.init()
```

Open <http://localhost:3000/api-docs> to view the UI. The controller generates the spec on the first request and caches it for subsequent requests.

## Custom mount path

Use controller prefixes to change the base path:

```ts
app.registerControllers(['docs/swagger', SwaggerController])
await app.init()
```

The endpoints shift accordingly: `/docs/swagger`, `/docs/swagger/spec.json`, etc.

## Custom options

To set a title, version, CORS policy, or other options, instantiate `SwaggerController` yourself and expose it through the provide registry:

```ts
import { createProvideRegistry } from '@prostojs/infact'
import { SwaggerController } from '@moostjs/swagger'

const swagger = new SwaggerController({
  title: 'Internal API',
  description: 'Internal services for the dashboard',
  version: '2025.1',
  cors: 'https://docs.example.com',
  servers: [
    { url: 'https://api.example.com', description: 'Production' },
    { url: 'https://staging.example.com', description: 'Staging' },
  ],
})

app.setProvideRegistry(
  createProvideRegistry([SwaggerController, () => swagger])
)
app.registerControllers(SwaggerController)
```

See [Configuration](/swagger/configuration) for the full options reference.

## YAML output

The spec is available in both JSON and YAML formats. YAML is converted from the JSON spec using a built-in zero-dependency converter. This is useful when:

- Sharing specs with frontend teams who prefer YAML
- Pasting into documentation that expects YAML
- Feeding into tools that accept YAML input

Access it at `/api-docs/spec.yaml` alongside the JSON version at `/api-docs/spec.json`.

## CORS

Enable CORS headers on all swagger endpoints:

```ts
// Allow any origin
new SwaggerController({ title: 'My API', cors: true })

// Allow a specific origin
new SwaggerController({ title: 'My API', cors: 'https://docs.example.com' })
```

This is useful when the spec is consumed by tools hosted on a different domain (documentation portals, SDK generators, API testing tools).

## Programmatic access

If you host the UI elsewhere or need the spec for code generation, call `mapToSwaggerSpec()` directly:

```ts
import { mapToSwaggerSpec } from '@moostjs/swagger'

const spec = mapToSwaggerSpec(app.getControllersOverview(), {
  title: 'External Docs',
  version: '2025.1',
})
```

The function returns a plain object matching the OpenAPI 3.0 / 3.1 structure. It accepts the same options as `SwaggerController`.

The generator reuses component schemas, so repeated types appear as `$ref`s automatically. You can serialize the result to JSON or YAML and serve it however you need.
