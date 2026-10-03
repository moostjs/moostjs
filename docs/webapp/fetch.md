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

### `http.invoke(method, path, opts?)` — inside the current request

```ts
import { MoostHttp } from '@moostjs/event-http'
import { useControllerContext } from 'moost'

@Post('bulk-close')
async bulkClose(@Body() body: { ids: number[] }) {
  const http = await useControllerContext().instantiate(MoostHttp)
  for (const batch of chunk(body.ids, 100)) {
    await http.invoke('POST', '/issues/close', { body: { ids: batch } })
  }
}
```

Runs another route's full pipeline **inside the current request** and resolves to the handler's return value (or rejects with its error — a guard's `reply(new HttpError(...))` included). Unlike `fetch()`, no new request is built: the route reads the caller's request, headers and authorization directly, so custom identity headers and mTLS work without `forwardHeaders`.

| Option | Effect |
| --- | --- |
| `body` | The parsed body the route sees (`@Body()`, `useBody().parseBody()`); `@RawBody()` / `rawBody()` get its JSON (or the string / `Buffer` itself) |
| `rawBody` | Raw bytes instead of the derived ones; with no `body`, they are parsed by `contentType` |
| `contentType` | What `useBody().is()` checks — default derived from `body` (`application/json` for objects) |
| `isolate` | Slots / `defineWook` composables of the caller the route must compute for itself instead of reading through |
| `prepare` | `(ctx) => void` — called with the route's child context before it runs: seed extra slots, or keep `ctx` to read what the route left in it after `invoke()` settled |

What the invoked route gets of its own: its body (never the caller's — an empty body when no `body`/`rawBody` is given), route params, controller context (`useControllerContext()`), interceptor state and a `FOR_EVENT` DI scope released as soon as its handler settles. What it shares: the request object, headers, URL and query string of the caller.

-   **DO** use it to delegate to another controller's route in-process (batches, fan-out) when the route must run its own guards, pipes and validation.
-   **DON'T** expect response side effects — status, headers and cookies the route sets go to a detached response and are discarded. Writing to `useResponse().getRawRes()` directly would still hit the caller's socket.
-   **DON'T** rely on `useRequest().url`, query params or `content-length` inside the invoked route — they describe the caller's request.
-   Rejects with `HttpError(404)` when no route matches `method` + `path` (`path` is the full mounted path, global prefix included).

To call another controller's *methods* (not a route) as that controller, see [`withControllerContext()`](/moost/di/#running-code-as-another-controller).

### Header forwarding

When called from within an existing HTTP context (e.g. during SSR rendering), identity headers (`authorization`, `cookie`, `accept-language`, `x-forwarded-for`, `x-request-id`) are automatically forwarded from the calling request to the programmatic request. Explicitly set headers take priority. `Set-Cookie` headers produced by the inner call propagate back onto the calling request's response.

The forwarded list is configurable via the adapter's `forwardHeaders` option:

```ts
import { DEFAULT_FORWARD_HEADERS } from '@wooksjs/event-http'

const http = new MoostHttp({
  forwardHeaders: [...DEFAULT_FORWARD_HEADERS, 'cloudfront-viewer-address'],
})
```

::: warning `forwardHeaders` replaces the defaults
A bare list like `forwardHeaders: ['cloudfront-viewer-address']` **replaces** the default set — you'd silently lose `authorization`/`cookie` forwarding. Always spread `DEFAULT_FORWARD_HEADERS` when you mean to extend it. Set `forwardHeaders: false` to disable forwarding entirely.
:::

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

::: warning What counts as "local"
- **String inputs** are only intercepted when they start with `/` (relative paths).
- **`URL` and `Request` inputs** are intercepted when the hostname is `localhost` or `127.0.0.1`.
- An **absolute URL string** like `fetch('http://localhost:3000/api/x')` is NOT intercepted — it goes out over real HTTP (and fails in dev SSR, where no real server is listening).

Always use relative paths (`fetch('/api/...')`) in universal code.
:::

### Automatic setup with Vite

When using `@moostjs/vite`, local fetch is enabled automatically (controlled by the `ssrFetch` option, default `true`). No manual setup needed — any `fetch('/api/...')` call during SSR goes through Moost in-process.

Set `ssrFetch: false` when running behind Nitro or another framework that manages fetch routing itself.

## SSR viewer identity

With `@moostjs/vite`, every SSR render runs inside an HTTP event context seeded from the incoming page request — in dev and in the generated production server alike. [Header forwarding](#header-forwarding) therefore applies to every SSR self-call with **zero app code**:

- **Auth-aware SSR** — an SSR fetch to a cookie- or bearer-guarded endpoint authenticates as the page viewer, so pages can server-render user-specific data.
- **Per-viewer rate limiting** — interceptors keying on IP or identity see the real viewer, not the synthetic in-process request. Without this, every SSR self-call across your whole fleet buckets under one `ip:127.0.0.1` subject — a single shared budget that a default per-IP rule turns into a site-wide SSR cap.
- **Trace continuity** — `x-request-id` flows from the page request through every SSR self-call.
- **`Set-Cookie` propagation** — cookies set by API handlers during the render (session touch/refresh) land on the page response.

Opt out with `ssrFetchForwarding: false` in the [plugin options](/webapp/vite#options) (or in `createSSRServer()` options for a custom server entry) — SSR self-calls are then anonymous, as they were on `@moostjs/vite` ≤ 0.6.30.

### Custom production servers

If you run your own server (not the generated one), wrap the render call yourself with `withHttpContext` — it creates the HTTP context without route dispatch and hands back buffered cookies:

```ts
const { result, response } = await http.withHttpContext(req, res, () => render(url, ctx))
for (const cookie of response.getSetCookieStrings()) {
  res.appendHeader('set-cookie', cookie)
}
```

Requires `@wooksjs/event-http` ≥ 0.7.20.

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
