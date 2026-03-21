---
outline: deep
---

# Programmatic Fetch (SSR)

`MoostHttp` provides `fetch()` and `request()` methods for invoking route handlers in-process with the full Moost pipeline — interceptors, DI, argument resolution, pipes, and validation — without a TCP round-trip.

## API

### `http.fetch(request)`

```ts
const response = await http.fetch(new Request('http://localhost/api/hello/world'))
// Response | null
```

Accepts a Web Standard `Request`. Returns a `Response` if a route matched, or `null` if no route exists.

### `http.request(input, init?)`

```ts
const response = await http.request('/api/hello/world')
const response = await http.request('/api/users', {
  method: 'POST',
  body: JSON.stringify({ name: 'Alice' }),
  headers: { 'content-type': 'application/json' },
})
// Response | null
```

Convenience wrapper — accepts a URL string (relative paths auto-prefixed with `http://localhost`), URL object, or Request, plus optional `RequestInit`.

### Header forwarding

When called from within an existing HTTP context (e.g. during SSR rendering), identity headers (`authorization`, `cookie`, `accept-language`, `x-forwarded-for`, `x-request-id`) are automatically forwarded from the calling request to the programmatic request. Explicitly set headers take priority.

## SSR Local Fetch

`enableLocalFetch` patches `globalThis.fetch` so that local requests are routed in-process through Moost. External URLs pass through to real HTTP. If no Moost route matches, the call falls back to the original `fetch`.

```ts
import { enableLocalFetch } from '@moostjs/event-http'

const teardown = enableLocalFetch(http)

// Local path → in-process via Moost
const res = await fetch('/api/hello/world')

// External URL → real HTTP
const res = await fetch('https://api.example.com/data')

// Restore original fetch
teardown()
```

### Automatic setup with Vite

When using `@moostjs/vite`, local fetch is enabled automatically (controlled by the `ssrFetch` option, default `true`). No manual setup needed — any `fetch('/api/...')` call during SSR goes through Moost in-process.

Set `ssrFetch: false` when running behind Nitro or another framework that manages fetch routing itself.

### Production usage

In production (without Vite), call `enableLocalFetch` manually in your server entry:

```ts
import { Moost } from 'moost'
import { MoostHttp, enableLocalFetch } from '@moostjs/event-http'

const app = new Moost()
const http = new MoostHttp()
enableLocalFetch(http)

app.adapter(http).listen(3000)
app.registerControllers(AppController)
await app.init()
```

## Use case: Universal SSR clients

With programmatic fetch, the same client interface works in both browser and server:

```ts
// Browser: real HTTP
const res = await fetch('/api/users')

// Server (SSR): in-process via Moost, same code
const res = await fetch('/api/users')
```

No separate client classes needed. The `enableLocalFetch` patch makes `fetch` transparent — server-side code calls the same API endpoints with the full pipeline, zero network overhead.
