# Body Limits & Security

Moost HTTP provides built-in protection against oversized request bodies and compression bombs. Limits can be configured at three levels, each overriding the previous.

## App-wide defaults

Pass `requestLimits` when creating the HTTP adapter:

```ts
import { MoostHttp } from '@moostjs/event-http'
import { Moost } from 'moost'

const app = new Moost()

void app.adapter(new MoostHttp({
    requestLimits: {
        maxCompressed: 5 * 1024 * 1024,   // 5 MB compressed (default: 1 MB)
        maxInflated: 50 * 1024 * 1024,     // 50 MB decompressed (default: 10 MB)
        maxRatio: 200,                     // compression ratio limit (default: 100)
        readTimeoutMs: 30_000,             // body read timeout (default: 10 000 ms)
    },
})).listen(3000)

void app.init()
```

| Option | Default | Description |
|---|---|---|
| `maxCompressed` | 1 MB | Max compressed body size in bytes |
| `maxInflated` | 10 MB | Max decompressed body size in bytes |
| `maxRatio` | 100 | Max compression ratio (zip-bomb protection) |
| `readTimeoutMs` | 10 000 ms | Body read timeout |

## Per-handler overrides

Use decorators to set limits on specific handlers or controllers:

```ts
import {
    BodySizeLimit,
    CompressedBodySizeLimit,
    BodyReadTimeoutMs,
    Post,
} from '@moostjs/event-http'
import { Controller, Body } from 'moost'

@Controller('upload')
export class UploadController {
    @Post('')
    @BodySizeLimit(50 * 1024 * 1024)           // 50 MB inflated
    @CompressedBodySizeLimit(10 * 1024 * 1024)  // 10 MB compressed
    @BodyReadTimeoutMs(60_000)                  // 60 seconds
    async upload(@Body() payload: unknown) {
        return { received: true }
    }
}
```

These decorators work on both handlers and controllers. When applied to a controller, all handlers inherit the limits.

## Global interceptors

For organization-wide policies applied through code (e.g., from a shared library), use the global interceptor helpers:

```ts
import {
    globalBodySizeLimit,
    globalCompressedBodySizeLimit,
    globalBodyReadTimeoutMs,
} from '@moostjs/event-http'
import { Moost } from 'moost'

const app = new Moost()
app.applyGlobalInterceptors(
    globalBodySizeLimit(20 * 1024 * 1024),
    globalCompressedBodySizeLimit(5 * 1024 * 1024),
    globalBodyReadTimeoutMs(15_000),
)
```

## Override precedence

Limits are applied in this order (later wins):

1. Constructor defaults (`requestLimits`)
2. Global interceptors (`app.applyGlobalInterceptors(...)`)
3. Controller-level decorators (`@BodySizeLimit` on class)
4. Handler-level decorators (`@BodySizeLimit` on method)

## 404 handling

When no route matches a request, Moost runs the response through the global interceptor chain before returning a `404 Resource Not Found` error. This means your global error handlers and logging interceptors will catch 404s too.

## Custom server integration

### Using getServerCb()

To integrate Moost HTTP with an existing Node.js server or serverless runtime, use `getServerCb()`:

```ts
import { MoostHttp } from '@moostjs/event-http'
import { Moost } from 'moost'
import { createServer } from 'http'

const app = new Moost()
const http = app.adapter(new MoostHttp())

void app.registerControllers(MyController).init()

// Use with a custom Node.js server
const server = createServer(http.getServerCb())
server.listen(3000)
```

This is useful for:
- **Serverless functions** — pass the callback to your serverless framework
- **Custom HTTPS** — create an `https.createServer` with your own certificates
- **Testing** — use with libraries like `supertest`
