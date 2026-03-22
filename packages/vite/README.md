# @moostjs/vite

Vite dev plugin for [Moost](https://moost.org). Enables hot module replacement for Moost HTTP applications during development, automatic adapter detection, and production build configuration.

Supports two modes:
- **Backend mode** (default) — Moost owns the server, Vite provides HMR and TypeScript transforms
- **Middleware mode** — Vite serves the frontend (Vue, React, etc.), Moost handles API routes as middleware

## Installation

```bash
npm install @moostjs/vite --save-dev
```

## Backend Mode (default)

For pure API servers where Moost handles all HTTP requests. Vite is used as a dev tool for HMR and decorator transforms.

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

Run with `vite dev`. The plugin patches `MoostHttp.listen()` so Moost doesn't bind a port — Vite's dev server handles HTTP instead. Controller changes trigger HMR with automatic DI cleanup.

## Middleware Mode

For fullstack apps where Vite serves the frontend and Moost handles API routes. Unmatched requests fall through to Vite's default handler (static assets, Vue/React pages, HMR client).

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
    }),
  ],
})
```

```ts
// src/api/main.ts
import { Moost, Param } from 'moost'
import { MoostHttp, Get } from '@moostjs/event-http'

class ApiController extends Moost {
  @Get('api/hello/:name')
  hello(@Param('name') name: string) {
    return { message: `Hello ${name}!` }
  }
}

const app = new ApiController()
const http = new MoostHttp()
app.adapter(http).listen(3000)
app.init()
```

Requests matching Moost routes (e.g. `/api/hello/world`) are handled by Moost with the full pipeline (interceptors, DI, validation). Everything else (`/`, `/about`, static assets) falls through to Vite.

The optional `prefix` option adds a fast-path check — requests not matching the prefix skip Moost entirely:

```ts
moostVite({
  entry: './src/api/main.ts',
  middleware: true,
  prefix: '/api',
})
```

## SSR Mode

Add `ssrEntry` to enable server-side rendering. The plugin handles everything automatically — SSR rendering in dev, multi-environment builds for production:

```ts
moostVite({
  entry: '/src/main.ts',
  middleware: true,
  prefix: '/api',
  ssrEntry: '/src/entry-server.ts',
})
```

In dev, the plugin adds an SSR fallback middleware that renders pages on the server using your `entry-server.ts`. In production, `vite build` produces three bundles in a single pass:

- **client** — optimized browser assets (`dist/client/`)
- **ssr** — server-side render function (`dist/server/ssr/`)
- **server** — production Node.js server (`dist/server/server.js`)

### SPA Mode

Omit `ssrEntry` and Vite serves the app as a standard SPA. The production build still generates a server that serves static files and API routes — it just skips server-side rendering.

### Custom Server Entry

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

```ts
// server.ts
import { createSSRServer } from '@moostjs/vite/server'

const app = await createSSRServer()
// app.use(compression())
await app.listen()
```

`createSSRServer` handles dev/prod branching — in dev it creates a Vite dev server, in prod it serves built assets with `sirv`.

## SSR Local Fetch

When `ssrFetch` is enabled (default: `true`), the plugin patches `globalThis.fetch` so that local paths are routed in-process through Moost instead of making a real HTTP request. This is useful for SSR where server-side code fetches from its own API:

```ts
// During SSR rendering:
const res = await fetch('/api/hello/world')
// → Routed in-process to Moost, no TCP round-trip
```

If no Moost route matches, the call falls back to the original `fetch`. External URLs (e.g. `https://api.example.com`) always go through real HTTP.

Disable with `ssrFetch: false` when running behind Nitro or another framework that manages fetch routing itself.

## Hot Module Replacement

Both modes support full HMR for Moost controllers:

1. File change detected → Vite invalidates the module graph
2. Moost DI container is cleaned up (stale instances ejected, dependants cascade)
3. The SSR entry is re-imported → Moost re-initializes with updated controllers
4. New requests use the updated code — no server restart needed

The plugin injects a `__VITE_ID` decorator on `@Injectable` and `@Controller` classes to track which file each class belongs to, enabling precise cleanup during hot reloads.

## Options

| Option | Type | Default | Description |
|---|---|---|---|
| `entry` | `string` | — | Application entry file (required) |
| `port` | `number` | `3000` | Dev server port (backend mode only) |
| `host` | `string` | `'localhost'` | Dev server host (backend mode only) |
| `outDir` | `string` | `'dist'` | Build output directory (backend mode only) |
| `format` | `'cjs' \| 'esm'` | `'esm'` | Output module format (backend mode only) |
| `sourcemap` | `boolean` | `true` | Generate source maps (backend mode only) |
| `externals` | `boolean \| object` | `true` | Configure external dependencies (backend mode only) |
| `onEject` | `function` | — | Hook to control DI instance ejection during HMR |
| `ssrFetch` | `boolean` | `true` | Enable local fetch interception for SSR |
| `middleware` | `boolean` | `false` | Run Moost as Connect middleware (Vite serves frontend) |
| `prefix` | `string` | — | URL prefix filter for middleware mode (e.g. `'/api'`) |
| `ssrEntry` | `string` | — | Vue/React SSR entry module (e.g. `'/src/entry-server.ts'`) |
| `ssrOutlet` | `string` | `'<!--ssr-outlet-->'` | HTML placeholder for SSR-rendered content |
| `ssrState` | `string` | `'<!--ssr-state-->'` | HTML placeholder for SSR state transfer script |
| `serverEntry` | `string` | — | Custom production server entry file (e.g. `'./server.ts'`) |

Options marked "backend mode only" are ignored when `middleware: true` — the user's `vite.config.ts` controls build/server configuration in middleware mode.

## License

MIT
