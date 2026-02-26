# Static Files & Proxy

Moost works with Wooks composables for serving static files and proxying requests.

## Static files

### Installation

```bash
npm install @wooksjs/http-static
```

### Basic usage

Use `serveFile()` to serve a file. It returns a readable stream and sets appropriate response headers, including caching and range request support.

```ts
import { serveFile } from '@wooksjs/http-static'
import { Get } from '@moostjs/event-http'
import { Controller, Param } from 'moost'

@Controller()
export class StaticController {
    @Get('static/*')
    serve(@Param('*') filePath: string) {
        return serveFile(filePath, {
            baseDir: './public',
            cacheControl: { maxAge: '10m' },
        })
    }
}
```

### Options

| Option | Type | Description |
|---|---|---|
| `baseDir` | `string` | Base directory for resolving file paths |
| `cacheControl` | `string \| object` | Cache-Control header value |
| `expires` | `string` | Expires header value |
| `pragmaNoCache` | `boolean` | Add `Pragma: no-cache` header |
| `headers` | `object` | Additional response headers |
| `defaultExt` | `string` | Default extension when none is provided |
| `index` | `string` | Index file to serve from directories |
| `listDirectory` | `boolean` | List files if path is a directory |

## Proxy

### Installation

```bash
npm install @wooksjs/http-proxy
```

### Basic usage

Use `useProxy()` to create a proxy function that forwards requests to a target URL:

```ts
import { useProxy } from '@wooksjs/http-proxy'
import { Get } from '@moostjs/event-http'
import { Controller } from 'moost'

@Controller()
export class ProxyController {
    @Get('api/*')
    proxy() {
        const proxy = useProxy()
        return proxy('https://api.example.com/v1')
    }
}
```

The proxy function forwards the request and returns a fetch `Response`.

### Filtering headers and cookies

Control what gets forwarded:

```ts
@Get('api/*')
proxy() {
    const proxy = useProxy()
    return proxy('https://api.example.com', {
        reqHeaders: { block: ['referer', 'cookie'] },
        reqCookies: { block: '*' },
    })
}
```

### Modifying responses

The proxy returns a standard fetch `Response`, so you can modify it before returning:

```ts
@Get('api/data')
async proxyData() {
    const proxy = useProxy()
    const response = await proxy('https://api.example.com/data')
    const data = await response.json()
    return { ...data, proxied: true }
}
```

### Advanced options

```ts
proxy('https://target.com/path', {
    method: 'GET',                              // override HTTP method
    reqHeaders: { block: ['referer'] },         // block request headers
    reqCookies: { allow: ['session'] },         // allow specific cookies
    resHeaders: { overwrite: { 'x-proxy': 'moost' } }, // add response headers
    resCookies: { allow: ['session'] },         // filter response cookies
    debug: true,                                // log proxy details
})
```
