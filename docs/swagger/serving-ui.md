# Serving Swagger UI

`@moostjs/swagger` ships with a controller that serves both the generated OpenAPI document and the Swagger UI bundle. Once registered, the following endpoints become available (default base path: `/api-docs`):

| Endpoint | Description |
| --- | --- |
| `/api-docs` | HTML shell that bootstraps Swagger UI |
| `/api-docs/spec.json` | Cached OpenAPI 3 document returned by `mapToSwaggerSpec()` |
| `/api-docs/swagger-ui-*.{js,css}` | Static assets (bundled from `swagger-ui-dist`) |

## Accessing the UI

```ts
import { Moost } from 'moost'
import { MoostHttp } from '@moostjs/event-http'
import { SwaggerController } from '@moostjs/swagger'

const app = new Moost()
app.adapter(new MoostHttp())
app.registerControllers(SwaggerController)
await app.init()
```

Open <http://localhost:3000/api-docs> to view the UI. The controller caches the generated spec, so repeated requests are fast.

## Customising the mount path

Use controller prefixes to change the base path. For example, mount the docs under `/docs/swagger`:

```ts
app.registerControllers(['docs/swagger', SwaggerController])
await app.init()
```

The table above will then shift accordingly (`/docs/swagger`, `/docs/swagger/spec.json`, etc.).

## Providing a preconfigured controller

To set custom options (title, version, CORS policy) instantiate `SwaggerController` yourself and expose it through Moost’s provide registry:

```ts
import { createProvideRegistry } from '@prostojs/infact'
import { SwaggerController } from '@moostjs/swagger'

const swagger = new SwaggerController({
  title: 'Internal API',
  version: '2025.1',
  cors: 'https://docs.example.com',
})

app.setProvideRegistry(
  createProvideRegistry([SwaggerController, () => swagger])
)
app.registerControllers(SwaggerController)
```

Because the instance lives in the registry you can subclass `SwaggerController` or decorate it with additional Moost hooks if needed.

## Consuming `spec.json`

If you host the UI elsewhere (documentation portal, CI pipeline, SDK generator) you can still call `mapToSwaggerSpec()` manually:

```ts
import { mapToSwaggerSpec } from '@moostjs/swagger'

const spec = mapToSwaggerSpec(app.getControllersOverview(), {
  title: 'External Docs',
  version: '2025.1',
})
```

Serve the resulting JSON wherever you need it. The generator reuses component schemas, so repeated types appear as `$ref`s automatically.
