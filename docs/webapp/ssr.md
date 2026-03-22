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

With [local fetch](/webapp/fetch) enabled (default), `fetch('/api/...')` calls Moost handlers in-process during SSR — no HTTP round-trip:

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
