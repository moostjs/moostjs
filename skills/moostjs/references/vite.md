# Vite Plugin — @moostjs/vite

Dev plugin + production build orchestration for Moost apps on Vite: HMR, adapter detection, decorator transforms, and a generated prod server. One project shape runs as a backend API, an API-behind-frontend middleware app, SSR, or SPA.

- [Setup & modes](#setup--modes)
- [Backend mode](#backend-mode)
- [Middleware mode](#middleware-mode)
- [SSR / SPA mode](#ssr--spa-mode)
- [Production server](#production-server)
- [Custom server entry](#custom-server-entry)
- [SSR externalization & single-instance guard](#ssr-externalization--single-instance-guard)
- [Options](#options)
- [Key imports](#key-imports)
- [Gotchas](#gotchas)

## Setup & modes

```bash
npm create moost@latest [name] -- --http   # backend API
npm create moost@latest [name] -- --ssr     # Vue + Moost fullstack (SSR/SPA)
npm install @moostjs/vite --save-dev         # add to existing project
```

| Mode | Config | Build output |
|---|---|---|
| Backend (default) | `moostVite({ entry })` | Moost is the server; single `dist/` bundle |
| Middleware | `+ middleware: true, prefix` | Vite serves frontend, Moost serves `prefix/*`; `dist/client` + `dist/server` |
| SSR | middleware `+ ssrEntry` | adds server-side render; forces `appType: 'custom'` |
| SPA | middleware, no `ssrEntry` | static + API, client renders; prod server still generated |

## Backend mode

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import { moostVite } from '@moostjs/vite'

export default defineConfig({
  plugins: [moostVite({ entry: './src/main.ts' })],
})
```

`entry` is a standard Moost app that calls `.listen()`. In dev the plugin patches `MoostHttp.listen()` so Vite owns the server. `vite dev` to run, `vite build` for prod.

## Middleware mode

```ts
moostVite({ entry: '/src/api/main.ts', middleware: true, prefix: '/api' })
```

Moost handles requests matching `prefix`; everything else falls through to Vite (frontend, static, HMR). `prefix` is normalized to leading-slash / no-trailing-slash and adds a fast-path skip for non-API requests.

## SSR / SPA mode

```ts
moostVite({
  entry: '/src/main.ts',
  middleware: true,
  prefix: '/api',
  ssrEntry: '/src/entry-server.ts', // omit for SPA
})
```

`vite build` emits three bundles in one pass: **client** (`dist/client/`), **ssr** render fn (`dist/server/ssr/`), **server** (`dist/server/server.js`). With [SSR local fetch](event-http.md) (default), `fetch('/api/...')` during SSR calls Moost in-process — no loopback. SSR vs SPA differ only by the presence of `ssrEntry`.

## Production server

```bash
node dist/server/server.js
```

Auto-generated. Serves static assets (`sirv`) + API routes (Moost) + SSR render or SPA fallback. The Moost `entry` is built to `dist/server/<entry-basename>.js` (e.g. `main.js`) and imported by the server at runtime — no hand-authored Node wrapper needed.

## Custom server entry

For custom prod middleware (compression, auth, logging):

```ts
// server.ts
import { createSSRServer } from '@moostjs/vite/server'
const app = await createSSRServer()
// app.use(compression())
await app.listen()
```

```ts
moostVite({ entry: '/src/main.ts', middleware: true, prefix: '/api', serverEntry: './server.ts' })
```

`createSSRServer` handles dev/prod automatically. `serverEntry` is used only during `vite build`. `createSSRServer({ entry: () => import('./src/main') })` is an escape hatch that bundles the entry via the function instead of the baked define.

## SSR externalization & single-instance guard

The moost/wooks runtime relies on per-module `Symbol` slot keys (`cached()`/`key()`). Two copies = split event context = `undefined` reads in prod only. Invariants:

1. **Default build = `ssr.noExternal: true`** — every dep is bundled → single instance. Dev (`vite serve`) keeps a selective allowlist (Vite's ESM-only SSR runner can't eval CJS-only deps like `@vue/server-renderer`).
2. **Explicit `ssr.noExternal` list** (e.g. to bundle `.as`-shipping packages like `@aooth/*` / `@atscript/*` for `unplugin-atscript`) externalizes everything *not* listed.
3. **Single-instance guard** — when you set an explicit `noExternal` list at build time, the plugin auto-force-bundles `moost`, `@moostjs/*`, `@wooksjs/*`, `wooks` alongside your list, so the runtime stays one instance and `useRequest()` / `useHeaders()` / `useAuthorization()` keep working in prod.
4. **Don't externalize the runtime piecemeal.** A bundled listed package importing `@wooksjs/*` while `moost` stays external is the split. If you must externalize, externalize the **whole** runtime (`@wooksjs/event-http`, `@wooksjs/event-core`, `wooks`, …) **and** add them as direct deps — the guard detects an externalized runtime (any match in `ssr.external` / `ssrExternal`) and backs off.
5. **Shrink `dist/server/`** by externalizing stable single-canonical-build libs only: `ssr.external` / `ssrExternal: ['vue', 'vue-router', '@vue/server-renderer']`. Never externalize Symbol-slot-key packages (moost, wooks) or anything not reliably pnpm-hoisted.

## Options

| Option | Type | Default | Notes |
|---|---|---|---|
| `entry` | `string` | — | required; Moost app entry. `/src/...` (root-rel) or `./src/...` |
| `middleware` | `boolean` | `false` | run Moost as Connect middleware behind Vite |
| `prefix` | `string` | — | URL prefix filter for middleware mode |
| `ssrEntry` | `string` | — | Vue/React SSR entry (e.g. `/src/entry-server.ts`) |
| `ssrOutlet` / `ssrState` | `string` | `<!--ssr-outlet-->` / `<!--ssr-state-->` | HTML placeholders |
| `serverEntry` | `string` | — | custom prod server entry; auto-generated when omitted |
| `ssrExternal` | `string[]` | — | packages to keep external in middleware SSR build (≡ `ssr.external`) |
| `ssrFetch` | `boolean` | `true` | in-process `fetch('/api/...')` during SSR |
| `port`/`host`/`outDir`/`format`/`sourcemap`/`externals` | — | — | **backend mode only**; middleware mode uses `vite.config` |
| `onEject` | `function` | — | per-instance hook during HMR DI cleanup |

## Key imports

```ts
import { moostVite } from '@moostjs/vite'             // vite.config.ts plugin
import { createSSRServer } from '@moostjs/vite/server' // custom dev/prod server entry
```

## Gotchas

- Middleware mode emits the Moost `entry` as `dist/server/<name>.js`; if the basename is `server` it's keyed `moost-entry` to avoid the reserved server-entry key.
- Under an explicit `noExternal` list, **never** externalize `@wooksjs/*` / `moost` piecemeal — the guard force-bundles them; a partial external split makes `useRequest()` etc. read `undefined` in prod only (dev dedupes via the SSR module runner, so it passes locally).
- `serverEntry` is build-only. For custom middleware in dev, run `tsx server.ts` instead of `vite`.
- `ssrEntry` forces `appType: 'custom'` (Vite stops serving HTML; the plugin's SSR fallback takes over).
- Backend-mode-only options (`port`, `host`, `outDir`, `format`, `sourcemap`, `externals`) are ignored in middleware mode.
- HMR covers the **full server import graph**, two paths: (a) controllers + their imports are HMR-bounded — stale DI instances + Wooks router/Mate caches are ejected via tracked `__vite_id` decorators; (b) modules the entry imports transitively (data-models, providers, `init`) re-import the entry and re-initialize the whole app. Both reload on the next request, no restart.
- Editing an entry-graph module in middleware+SSR dev re-imports the entry, which re-runs `app.listen()`; the plugin re-captures the patched `MoostHttp.listen()` on each reload so it never re-binds the dev port. Diagnose a dev `EADDRINUSE` on HMR as an out-of-date `@moostjs/vite` (versions ≤ 0.6.24 crashed here).

## See also

- [event-http.md](event-http.md) — MoostHttp, local fetch / SSR in-process routing.
- Docs: <https://moost.org/webapp/vite>, <https://moost.org/webapp/ssr>.
