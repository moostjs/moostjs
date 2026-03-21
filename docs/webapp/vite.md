---
outline: deep
---

# Vite Plugin

`@moostjs/vite` integrates Moost with Vite's dev server for hot module replacement, automatic adapter detection, and production build configuration.

## Installation

```bash
npm install @moostjs/vite --save-dev
```

## Backend Mode (default)

For API servers where Moost handles all HTTP requests. Vite provides HMR and TypeScript/decorator transforms — no SWC needed (Vite 8 uses Oxc which supports `emitDecoratorMetadata` natively).

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

Run `vite dev` to start. The plugin patches `MoostHttp.listen()` so Moost doesn't bind a port — Vite's dev server handles HTTP instead. Build with `vite build` for production.

## Middleware Mode

For fullstack apps where Vite serves the frontend (Vue, React, Svelte) and Moost handles API routes. Set `middleware: true` and Moost runs as Connect middleware — unmatched requests fall through to Vite's default handler.

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

Requests matching Moost routes (e.g. `/api/hello/world`) go through the full Moost pipeline. Everything else (`/`, `/about`, static assets, HMR client) falls through to Vite automatically.

### Prefix optimization

The optional `prefix` option adds a fast-path filter — requests not matching the prefix skip Moost entirely without route lookup:

```ts
moostVite({
  entry: './src/api/main.ts',
  middleware: true,
  prefix: '/api',
})
```

This is optional — without a prefix, Moost's router handles the no-match fallthrough. The prefix just avoids unnecessary route lookups for paths that are clearly not API routes.

## Hot Module Replacement

Both modes support full HMR for controllers:

1. **File change** — Vite detects the change and invalidates the module graph
2. **DI cleanup** — stale controller instances are ejected from the DI container, dependants cascade
3. **Re-initialization** — the entry module is re-imported, Moost re-initializes with updated code
4. **Zero downtime** — the next request uses updated controllers, no restart needed

The plugin injects a `__VITE_ID` decorator on `@Injectable` and `@Controller` classes to track which file each class belongs to, enabling precise instance cleanup.

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

::: tip
Options `port`, `host`, `outDir`, `format`, `sourcemap`, and `externals` are only used in backend mode. In middleware mode, your `vite.config.ts` controls build and server configuration.
:::
