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
const http = new MoostHttp()
app.adapter(http)
app.registerControllers(SwaggerController)
await app.init()
await http.listen(3000)
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
import { createProvideRegistry } from 'moost'
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

## Multiple swagger instances

You can serve several swagger UIs from different paths — for example, side-by-side OpenAPI 3.0 and 3.1 specs, or separate public/internal docs.

Create distinct instances with their own options and register each under a different prefix:

```ts
import { createProvideRegistry } from 'moost'
import { SwaggerController } from '@moostjs/swagger'

// OpenAPI 3.0 instance
class Swagger30 extends SwaggerController {}
const swagger30 = new Swagger30({
  title: 'My API (3.0)',
  openapiVersion: '3.0',
})

// OpenAPI 3.1 instance
class Swagger31 extends SwaggerController {}
const swagger31 = new Swagger31({
  title: 'My API (3.1)',
  openapiVersion: '3.1',
})

app.setProvideRegistry(
  createProvideRegistry(
    [Swagger30, () => swagger30],
    [Swagger31, () => swagger31],
  ),
)

app.registerControllers(
  ['docs/v3.0', Swagger30],
  ['docs/v3.1', Swagger31],
)
```

This serves two independent UIs at `/docs/v3.0` and `/docs/v3.1`, each with its own cached spec. The same approach works for any split — public vs internal, versioned APIs, etc.

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

If you host the UI elsewhere or need the spec for code generation, request `spec.json` in-process through the HTTP adapter — no port needs to be bound:

```ts
import { createProvideRegistry, Moost } from 'moost'
import { MoostHttp } from '@moostjs/event-http'
import { SwaggerController } from '@moostjs/swagger'

const app = new Moost()
const http = new MoostHttp()
app.adapter(http)
const swagger = new SwaggerController({ title: 'External Docs', version: '2025.1' })
app.setProvideRegistry(createProvideRegistry([SwaggerController, () => swagger]))
app.registerControllers(SwaggerController /* , ...your controllers */)
await app.init()

const res = await http.request('/api-docs/spec.json')
const spec = await res!.json()
```

`MoostHttp.request()` runs the route through the full dispatch pipeline without starting a server, so this works in build scripts and CI. The result is a plain object matching the OpenAPI 3.0 / 3.1 structure (use `/api-docs/spec.yaml` for YAML).

The generator reuses component schemas, so repeated types appear as `$ref`s automatically. You can serialize the result and serve it however you need.
