---
outline: deep
---

# Vite Plugin

`@moostjs/vite` integrates Moost with Vite's dev server for hot module replacement, automatic adapter detection, and production build configuration.

## Quick Start

Scaffold a project with everything pre-configured:

```bash
npm create moost -- --http    # API server
npm create moost -- --ssr     # Vue + Moost fullstack (SSR/SPA)
```

Or add to an existing project:

```bash
npm install @moostjs/vite --save-dev
```

## Backend Mode (default)

For API servers where Moost handles all HTTP requests. Vite provides HMR and TypeScript/decorator transforms.

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import { moostVite } from '@moostjs/vite'

export default defineConfig({
  plugins: [
    moostVite({
      entry: './src/main.ts',
    }),
  ],
})
```

Your entry file is a standard Moost app:

```ts
// src/main.ts
import { Moost, Param } from 'moost'
import { MoostHttp, Get } from '@moostjs/event-http'

class App extends Moost {
  @Get('hello/:name')
  hello(@Param('name') name: string) {
    return { message: `Hello ${name}!` }
  }
}

const app = new App()
const http = new MoostHttp()
app.adapter(http).listen(3000)
app.init()
```

Run `vite dev` to start, `vite build` for production.

## Middleware Mode

For fullstack apps where Vite serves the frontend (Vue, React, Svelte) and Moost handles API routes. Set `middleware: true` — Moost handles matching routes, everything else falls through to Vite.

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { moostVite } from '@moostjs/vite'

export default defineConfig({
  plugins: [
    vue(),
    moostVite({
      entry: './src/api/main.ts',
      middleware: true,
      prefix: '/api', // optional: skip Moost for non-API paths
    }),
  ],
})
```

The entry file is a standard Moost app (same as backend mode). The `prefix` option is optional — it adds a fast-path filter so requests not matching the prefix skip Moost entirely.

## SSR Mode

Add `ssrEntry` to enable server-side rendering:

```ts
moostVite({
  entry: '/src/main.ts',
  middleware: true,
  prefix: '/api',
  ssrEntry: '/src/entry-server.ts',
})
```

`vite build` produces three bundles in a single pass:

- **client** — browser assets (`dist/client/`)
- **ssr** — server-side render function (`dist/server/ssr/`)
- **server** — production Node.js server (`dist/server/server.js`)

Omit `ssrEntry` for SPA mode — the production build still generates a server for static files and API routes, just without server-side rendering.

See [Vue + Moost (SSR)](/webapp/ssr) for the full guide.

## Custom Server Entry

By default, `vite build` auto-generates a minimal production server. If you need custom middleware (compression, auth, logging), provide your own server file:

```ts
moostVite({
  entry: '/src/main.ts',
  middleware: true,
  prefix: '/api',
  ssrEntry: '/src/entry-server.ts',
  serverEntry: './server.ts',
})
```

Your `server.ts` uses `createSSRServer` from `@moostjs/vite/server`:

```ts
// server.ts
import { createSSRServer } from '@moostjs/vite/server'

const app = await createSSRServer()
// app.use(compression())
await app.listen()
```

`createSSRServer` handles dev/prod automatically.

::: tip
`serverEntry` is only used during `vite build`. In dev, the plugin handles SSR/SPA fallback directly. If you need custom middleware in dev too, run `tsx server.ts` instead of `vite`.
:::

## Hot Module Replacement

Both modes support full HMR for controllers. When a file changes, the plugin invalidates affected modules, cleans up stale DI instances (cascading to dependants), and re-initializes the app. The next request uses updated code — no restart needed.

## Options

| Option | Type | Default | Description |
|---|---|---|---|
| `entry` | `string` | — | Application entry file (required) |
| `port` | `number` | `3000` | Dev server port |
| `host` | `string` | `'localhost'` | Dev server host |
| `outDir` | `string` | `'dist'` | Build output directory |
| `format` | `'cjs' \| 'esm'` | `'esm'` | Output module format |
| `sourcemap` | `boolean` | `true` | Generate source maps |
| `externals` | `boolean \| object` | `true` | External dependencies config |
| `onEject` | `function` | — | Hook to control DI instance ejection during HMR |
| `ssrFetch` | `boolean` | `true` | Enable [SSR local fetch](/webapp/fetch) interception |
| `middleware` | `boolean` | `false` | Run Moost as Connect middleware |
| `prefix` | `string` | — | URL prefix filter for middleware mode |
| `ssrEntry` | `string` | — | Vue/React SSR entry module (e.g. `'/src/entry-server.ts'`) |
| `ssrOutlet` | `string` | `'<!--ssr-outlet-->'` | HTML placeholder for SSR-rendered content |
| `ssrState` | `string` | `'<!--ssr-state-->'` | HTML placeholder for SSR state transfer script |
| `serverEntry` | `string` | — | Custom production server entry file (e.g. `'./server.ts'`) |

::: tip
Options `port`, `host`, `outDir`, `format`, `sourcemap`, and `externals` are only used in backend mode. In middleware mode, your `vite.config.ts` controls build and server configuration.
:::
