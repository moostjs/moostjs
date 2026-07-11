---
outline: deep
---

# Vue + Moost (SSR)

Build a fullstack Vue + Moost application with server-side rendering, in-process API calls, and zero-config HMR.

## Scaffold a project

```bash
npm create moost -- --ssr
```

Or with a project name:

```bash
npm create moost my-app -- --ssr
```

The scaffolder asks whether to enable SSR (server-side rendering) or run as SPA only. Both modes share the same project structure — the difference is a single line in `vite.config.ts`.

## Project structure

```
my-app/
├── src/
│   ├── controllers/
│   │   └── api.controller.ts    # Moost API routes
│   ├── pages/
│   │   ├── Home.vue             # Landing page
│   │   └── About.vue            # About page
│   ├── main.ts                  # Moost server entry
│   ├── app.ts                   # Vue app factory
│   ├── entry-client.ts          # Client hydration
│   ├── entry-server.ts          # SSR render function
│   └── router.ts                # Vue Router config
├── public/                       # Static assets
├── index.html                    # HTML template
├── vite.config.ts                # Vite + Moost config
└── tsconfig.json
```

No `server.ts` needed — the plugin handles dev serving and auto-generates a production server during build.

## How it works

### vite.config.ts

```ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { moostVite } from '@moostjs/vite'

export default defineConfig({
  server: { port: 3000 },
  plugins: [
    vue(),
    moostVite({
      entry: '/src/main.ts',
      middleware: true,
      prefix: '/api',
      ssrEntry: '/src/entry-server.ts', // remove for SPA-only
    }),
  ],
})
```

The [`moostVite`](/webapp/vite) plugin runs in **middleware mode** — Moost handles `/api/*` routes, everything else falls through to Vite.

### API routes

```ts
// src/controllers/api.controller.ts
import { Controller, Param } from 'moost'
import { Get } from '@moostjs/event-http'

@Controller('api')
export class ApiController {
  @Get('hello/:name')
  hello(@Param('name') name: string) {
    return { message: `Hello, ${name}!`, timestamp: Date.now() }
  }
}
```

### SSR data fetching

With [local fetch](/webapp/fetch) enabled (default), `fetch('/api/...')` calls Moost handlers in-process during SSR — no HTTP round-trip. These self-calls carry the page viewer's identity (authorization, cookies, request id — see [SSR viewer identity](/webapp/fetch#ssr-viewer-identity)), so cookie-guarded endpoints, per-IP rate limits, and request tracing behave as if the browser called the API directly:

```vue
<script setup lang="ts">
import { ref, onServerPrefetch, onMounted, useSSRContext } from 'vue'

const ssrState = import.meta.env.SSR ? useSSRContext()! : (window as any).__SSR_STATE__ || {}
// Restore server-fetched data on the client so hydration matches the server HTML
const data = ref(ssrState.data ?? null)

// Server: in-process fetch via Moost (no network)
onServerPrefetch(async () => {
  const res = await fetch('/api/hello/SSR')
  data.value = await res.json()
  ssrState.state = { ...ssrState.state, data: data.value }
})

// Client fallback for SPA mode (no transferred state)
onMounted(async () => {
  if (!data.value) {
    const res = await fetch('/api/hello/SSR')
    data.value = await res.json()
  }
})
</script>
```

Initializing the ref from the transferred state is what makes the `window.__SSR_STATE__` transfer effective — without it the client hydrates with `null`, mismatches the server-rendered HTML, and refetches on every load.

## The render contract

`entry-server.ts` exports the `render(url, ctx?)` function the server calls for every non-API request. Beyond the app HTML it can return per-page `<head>` tags and control the HTTP response — the whole point of SSR for a public, crawlable site:

```ts
// src/entry-server.ts
import type { TSSRRenderContext, TSSRRenderResult } from '@moostjs/vite/server'

export async function render(url: string, ctx?: TSSRRenderContext): Promise<TSSRRenderResult> {
  // ...render the app for `url`, collect head tags & state...
  return {
    html, // → replaces <!--ssr-outlet--> in the <body>
    state, // → <script>window.__SSR_STATE__=…</script> at <!--ssr-state-->
    head, // → per-page <title>/<meta>/canonical/OG/JSON-LD at <!--ssr-head-->
    status, // → HTTP status code (default 200)
    headers, // → extra response headers
  }
}
```

Only `html` is required — a render returning `{ html }` or `{ html, state }` keeps working unchanged. Every marker is a plain string replacement, so a marker missing from `index.html` is simply skipped.

### The request context

The second argument, `ctx`, describes the incoming page request. It's optional and additive — a `render(url)` entry keeps working untouched:

- `ctx.headers` — raw request headers of the page request (`accept-language`, geo headers like `CloudFront-Viewer-*`, A/B or feature-flag cookies).
- `ctx.method` — HTTP method (the SSR fallbacks only render `GET` today).
- `ctx.req` — the raw Node `IncomingMessage`, as an escape hatch (socket address, etc.).

Use `ctx` for **viewer-dependent rendering** — picking a locale from `accept-language`, branching on a feature-flag cookie. You do *not* need it to authenticate SSR data fetching: identity headers are forwarded to in-process `fetch('/api/...')` calls automatically (see [SSR viewer identity](/webapp/fetch#ssr-viewer-identity)).

### Head tags for SEO

Per-page `<title>`, `<meta name="description">`, canonical, Open Graph and JSON-LD are why you server-render a public site. Place the `<!--ssr-head-->` marker inside `<head>` in `index.html`:

```html
<!-- index.html -->
<head>
  <!--ssr-head-->
</head>
```

Then return `head` as a ready-to-insert tag string — exactly what a head manager emits (e.g. unhead's `renderSSRHead(head).headTags`) — and those tags land in the crawler-visible initial HTML. Rename the marker with the [`ssrHead`](/webapp/vite#options) option if `<!--ssr-head-->` collides with your template.

### Status & headers

`status` and `headers` let a render drive the response:

- Return `status: 404` for a deleted or unknown slug — crawlers and CDNs treat a real 404 far better than a soft-404 (a not-found page served with `200`).
- Set `cache-control` (or any header) via `headers`.
- Redirect with `status: 301` and `headers: { location: '/new-url' }`.

Headers are applied after the default `Content-Type: text/html`, so a render may override it.

::: tip Version
On `@moostjs/vite` ≤ 0.6.28 `render()` honors only `{ html, state }` — `head` / `status` / `headers` and the `<!--ssr-head-->` marker are ignored. If you worked around the missing head seam by escaping the state `<script>` wrapper, drop that trick once upgraded and return `head` directly.

On `@moostjs/vite` ≤ 0.6.30 `render()` receives only `url` (no `ctx`), and SSR self-calls run without [viewer identity](/webapp/fetch#ssr-viewer-identity) — they reach the API anonymous, from `127.0.0.1`.
:::

## SSR vs SPA

The only difference between SSR and SPA mode is the `ssrEntry` option in `vite.config.ts`:

| | SSR | SPA |
|---|---|---|
| `ssrEntry` | `'/src/entry-server.ts'` | not set |
| First paint | Server-rendered HTML | Empty shell, client renders |
| SEO | Full content in initial HTML | Requires client-side hydration |
| Data fetching | `onServerPrefetch` runs on server | `onMounted` runs on client |

To switch, add or remove `ssrEntry` in your `moostVite()` options.

## Running

### Development

```bash
npm run dev
```

Runs `vite` — opens at [http://localhost:3000](http://localhost:3000). Vue pages have HMR, Moost controllers hot-reload without restart. The plugin handles SSR rendering in dev automatically.

### Production build

```bash
npm run build
```

Produces client assets, SSR bundle, and server bundle to `dist/` in a single pass.

### Production start

```bash
npm run start
```

Runs `node dist/server/server.js` — production server with static file serving, API routes, and SSR rendering (or SPA fallback).

## Custom server entry

If you need custom middleware in production (compression, auth, logging), see the [Custom Server Entry](/webapp/vite#custom-server-entry) section in the Vite Plugin docs.

## Related

- [Vite Plugin](/webapp/vite) — backend mode, middleware mode, HMR, and all plugin options
- [Programmatic Fetch](/webapp/fetch) — in-process route invocation and SSR local fetch
- [Routing & Handlers](/webapp/routing) — HTTP methods, route patterns, controllers
