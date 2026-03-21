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
├── server.ts                     # Dev/prod server entry
├── index.html                    # HTML template
├── vite.config.ts                # Vite + Moost config
└── tsconfig.json
```

## How it works

### vite.config.ts

```ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { moostVite } from '@moostjs/vite'

export default defineConfig({
  appType: 'custom',
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

The [`moostVite`](/webapp/vite) plugin runs in **middleware mode** — Moost handles `/api/*` routes, everything else falls through to Vite (static assets, Vue pages, HMR).

### server.ts

```ts
import { createSSRServer } from '@moostjs/vite/server'

const app = await createSSRServer()
await app.listen()
```

`createSSRServer` handles both dev and production:
- **Dev** — creates a Vite dev server with HMR, SSR rendering, and Moost middleware
- **Prod** — serves the built client assets with `sirv`, routes API requests to Moost, and renders pages with the SSR entry

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

Standard Moost controllers with the full pipeline — DI, interceptors, pipes, validation.

### SSR data fetching

Vue components can fetch data during server rendering using `onServerPrefetch`. With [local fetch](/webapp/fetch) enabled (default), `fetch('/api/...')` calls Moost handlers in-process — no HTTP round-trip:

```vue
<script setup lang="ts">
import { ref, onServerPrefetch, onMounted, useSSRContext } from 'vue'

const data = ref(null)
const ssrState = import.meta.env.SSR ? useSSRContext()! : (window as any).__SSR_STATE__ || {}

// Server: in-process fetch via Moost (no network)
onServerPrefetch(async () => {
  const res = await fetch('/api/hello/SSR')
  data.value = await res.json()
  ssrState.state = { ...ssrState.state, data: data.value }
})

// Client fallback for SPA mode
onMounted(async () => {
  if (!data.value) {
    const res = await fetch('/api/hello/SSR')
    data.value = await res.json()
  }
})
</script>
```

The same `fetch()` call works in both SSR and client — on the server it goes through Moost in-process, in the browser it makes a real HTTP request.

## SSR vs SPA

The only difference between SSR and SPA mode is the `ssrEntry` option in `vite.config.ts`:

| | SSR | SPA |
|---|---|---|
| `ssrEntry` | `'/src/entry-server.ts'` | not set |
| First paint | Server-rendered HTML | Empty shell, client renders |
| SEO | Full content in initial HTML | Requires client-side hydration |
| Data fetching | `onServerPrefetch` runs on server | `onMounted` runs on client |
| `entry-server.ts` | Used by the server | Unused (can be kept for later) |

To switch from SPA to SSR, add `ssrEntry: '/src/entry-server.ts'` to your `moostVite()` options.

## Running

### Development

```bash
npm run dev
```

Opens at [http://localhost:3000](http://localhost:3000). Vue pages have HMR, Moost controllers hot-reload without restart.

### Production build

```bash
npm run build
```

Builds client assets, SSR bundle, and server bundle to `dist/`.

### Production start

```bash
npm run start
```

Runs the production server with static file serving, API routes, and SSR rendering (or SPA fallback).

## Deployment target

`@moostjs/vite` builds for **Node.js** — the production server runs on `node dist/server.js`. This covers most deployment scenarios (VPS, Docker, cloud VMs, serverless Node runtimes).

For **edge runtimes**, **Cloudflare Workers**, **Deno Deploy**, or other non-Node targets, use [Nitro](https://nitro.build) as your server framework and integrate Moost as middleware. Set `ssrFetch: false` in `moostVite()` when Nitro manages fetch routing.

## Related

- [Vite Plugin](/webapp/vite) — backend mode, middleware mode, HMR, and all plugin options
- [Programmatic Fetch](/webapp/fetch) — in-process route invocation and SSR local fetch
- [Routing & Handlers](/webapp/routing) — HTTP methods, route patterns, controllers
