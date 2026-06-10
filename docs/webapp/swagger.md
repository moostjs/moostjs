# Swagger / OpenAPI

`@moostjs/swagger` generates an [OpenAPI 3](https://spec.openapis.org/oas/v3.0.3) document from your Moost controllers and serves a Swagger UI — all driven by the decorators you already use.

## Quick setup

```bash
npm install @moostjs/swagger
```

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

Open <http://localhost:3000/api-docs> to see the Swagger UI.

The generator automatically picks up `@Controller`, `@Get`/`@Post`/…, `@Param`, `@Query`, `@Body`, return types, and Atscript DTOs — so most endpoints are documented without any extra annotations.

::: tip Full documentation
For configuration options, decorator reference, schema customization, security schemes, and more, see the **[dedicated Swagger docs section](/swagger/)**.
:::
