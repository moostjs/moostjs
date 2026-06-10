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

The entry file is a standard Moost app (same as backend mode). The `prefix` option adds a fast-path filter so requests not matching the prefix skip Moost entirely.

::: warning Set `prefix` explicitly
In dev, omitting `prefix` sends every request through Moost first (unmatched ones fall through to Vite). In production, the generated server defaults the prefix to `'/api'` — only `/api/*` requests reach Moost, everything else goes to static/SSR. Always set `prefix` in middleware mode so dev and prod route the same way.
:::

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

`createSSRServer` handles dev/prod automatically. It accepts an optional options object (`TSSRServerOptions`) to override what the plugin configured: `entry`, `ssrEntry`, `prefix`, `port`, `clientDir`, `ssrOutlet`, `ssrState` — in production, anything you don't override comes from values baked in at build time. The returned handle (`TSSRServer`) exposes `use(middleware)` for Connect-style middleware and `listen(port?)`.

::: tip
`serverEntry` is only used during `vite build`. In dev, the plugin handles SSR/SPA fallback directly. If you need custom middleware in dev too, run `tsx server.ts` instead of `vite`.
:::

## Hot Module Replacement

Server-side HMR is scoped to the Moost entry graph: any file the server imports (reachable from `entry` — `.ts`, `.json`, anything) reloads the app, with no restart needed. On such an edit the plugin invalidates the changed files, ejects the affected DI instances (cascading to dependants), and re-initializes the app on the next request — the entry is re-imported in place, so editing a controller, data model or provider all behave the same, including in middleware + SSR mode where the dev server keeps owning the port.

Files outside the entry graph never touch the Moost app:

- **Client-side modules** (composables, stores, anything only the browser imports) keep Vite's regular HMR — browser updates flow as in any Vite app while the API keeps serving.
- **SSR render modules** (the `ssrEntry` graph) are refreshed by Vite's default invalidation, so the next server-rendered page picks them up without rebooting Moost.

If a server edit breaks the app (e.g. a syntax error), requests matching `prefix` (or all requests when no `prefix` is set) answer `502` with the load error instead of falling through to the frontend; the next edit retries the reload.

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
| `prefix` | `string` | `'/api'` (prod server) | URL prefix filter for middleware mode; the production server defaults to `'/api'` when omitted — set explicitly so dev and prod match |
| `ssrEntry` | `string` | — | Vue/React SSR entry module (e.g. `'/src/entry-server.ts'`) |
| `ssrOutlet` | `string` | `'<!--ssr-outlet-->'` | HTML placeholder for SSR-rendered content |
| `ssrState` | `string` | `'<!--ssr-state-->'` | HTML placeholder for SSR state transfer script |
| `serverEntry` | `string` | — | Custom production server entry file (e.g. `'./server.ts'`) |
| `ssrExternal` | `string[]` | — | Packages to keep external in the middleware-mode SSR build (concatenated with `cfg.ssr.external`). See [SSR Bundle Size](#ssr-bundle-size). |

::: tip
Options `port`, `host`, `outDir`, `format`, and `externals` are only used in backend mode — in middleware mode, your `vite.config.ts` controls build and server configuration. The exception is `sourcemap`: it applies in both modes (in middleware mode it controls source maps for the `dist/server/` SSR build, default `true`).
:::

## SSR Bundle Size

By default, `vite build` in middleware mode sets `ssr.noExternal: true` — every dependency is inlined into `dist/server/`. This avoids two failure modes:

- **Symbol-identity slot keys** — packages like `@wooksjs/event-http` use `Symbol()` as internal slot keys. When the same package is reachable via both an externalized path and a bundled path, each module instance creates fresh Symbols → slot lookups miss → request-time crashes. Bundling everything yields a single instance per package.
- **pnpm strict resolution** — externalized transitive deps may not be hoist-accessible from the consumer's top-level `node_modules`.

For real frontends, the resulting `dist/server/` chunk can exceed a megabyte (Vue + Vue Router + `@vue/server-renderer` alone is ~1.2 MB). To externalize stable upstream libraries:

```ts
export default defineConfig({
  ssr: {
    external: ['vue', 'vue-router', '@vue/server-renderer'],
  },
  plugins: [
    vue(),
    moostVite({ entry: '/src/main.ts', middleware: true, prefix: '/api', ssrEntry: '/src/entry-server.ts' }),
  ],
})
```

**Safe to externalize:** publicly-published, semver-stable libraries with a single canonical build (Vue, Vue Router, `@vue/server-renderer`, VueUse).

**Don't externalize:** workspace packages, anything that uses `Symbol()` as a public slot key (Moost, wooks), anything not reliably hoisted by pnpm.

You can also opt out of bundle-everything entirely by setting `ssr.noExternal` to an explicit list — the plugin honors it, appending `/^@moostjs\/vite($|\/)/` (so its `define:` substitutions still land) plus, unless you externalize the runtime yourself, the moost/wooks runtime patterns described below:

```ts
ssr: {
  noExternal: [/^@aooth\//, /^@atscript\//],
  external: ['vue', 'vue-router'],
}
```

When you use an explicit `noExternal` list, the plugin automatically keeps the **moost/wooks runtime** (`moost`, `@moostjs/*`, `@wooksjs/*`, `wooks`) bundled alongside your listed packages, so there is always a single runtime instance. Without this, any listed package that imports `@wooksjs/*` (e.g. `@aooth/*` and other `.as`-shipping libs) would pull in a second copy while externalized `moost` uses the first — splitting the event context so `useRequest()` / `useHeaders()` / `useAuthorization()` read `undefined` in production only. If you would rather externalize the runtime instead, list it under `ssr.external` (`['@wooksjs/event-http', '@wooksjs/event-core', 'wooks', …]`) and add those packages as direct dependencies — the plugin detects an externalized runtime and leaves your all-external setup intact.
