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

The entry file is a standard Moost app (same as backend mode). The `prefix` option is a pure optimization/guard — a single mount or a list of mounts (`prefix: ['/api', '/.well-known']`); requests outside every mount skip the Moost router entirely, in dev and in the generated production server alike.

Omitting `prefix` sends every request through Moost first; unmatched routes fall through to the frontend (Vite in dev, static/SSR in prod). Dev and prod route identically either way.

::: warning Version note
Up to and including `0.6.26`, `prefix` accepted only a single string, and the generated production server silently defaulted an omitted `prefix` to `'/api'` — a config that worked in dev could lose root-mounted routes (e.g. `/.well-known/*`) in production. On those versions, always set `prefix` explicitly.
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

Your `entry-server.ts` `render(url)` can return per-page `<head>` tags plus an HTTP status and headers, not just HTML and state — see [the render contract](/webapp/ssr#the-render-contract). See [Vue + Moost (SSR)](/webapp/ssr) for the full guide.

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

`createSSRServer` handles dev/prod automatically. It accepts an optional options object (`TSSRServerOptions`) to override what the plugin configured: `entry`, `ssrEntry`, `prefix`, `port`, `host`, `clientDir`, `ssrOutlet`, `ssrState`, `ssrHead` — in production, anything you don't override comes from values baked in at build time. The returned handle (`TSSRServer`) exposes `use(middleware)` for Connect-style middleware and `listen(port?, host?)`.

**Port and bind address.** In production, `listen(port?, host?)` resolves each value from the first one that is set:

- port: the `listen` argument, then the `port` option, then `PORT`, then `3000`
- host: the `listen` argument, then the `host` option, then `HOST`, then Node's default (all interfaces)

`HOST=127.0.0.1` keeps a built app loopback-only behind a reverse proxy, and it works with the generated server entry too. `await app.listen()` resolves with the bound Node server, which you can `close()` for a graceful shutdown. It rejects on a bind error (`EADDRINUSE`, `EACCES`, unknown host). In dev, Vite's `server.port` / `server.host` apply instead, and a port or host passed to `createSSRServer` / `listen` only logs a warning.

::: tip
`serverEntry` is only used during `vite build`. In dev, the plugin handles SSR/SPA fallback directly. If you need custom middleware in dev too, run `tsx server.ts` instead of `vite`.
:::

## Hot Module Replacement

Server-side HMR is scoped to the Moost entry graph: any file the server imports (reachable from `entry` — `.ts`, `.json`, anything) reloads the app, with no restart needed. On such an edit the plugin invalidates the changed files, ejects the affected DI instances (cascading to dependants), and re-initializes the app on the next request — the entry is re-imported in place, so editing a controller, data model or provider all behave the same, including in middleware + SSR mode where the dev server keeps owning the port.

Every ejected instance is **disposed** before the entry re-imports: its [`@MoostDispose`](/moost/app-dispose) hooks (or `Symbol.asyncDispose`/`Symbol.dispose`) are awaited, so a singleton that owns a connection, consumer, timer or file handle releases it instead of leaking one copy per reload — the replacement never races the old one. A failing hook is logged as a warning and the reload continues. An instance kept by an `onEject` veto is *not* disposed (it stays live and in use). If a resource still accumulates across reloads, its owner is missing a `@MoostDispose` hook. This holds across repeated reloads (exactly one runtime stays live) and after a boot that failed part-way — the instances that boot left behind are disposed by the next reload.

### What a reload rebuilds, and what it keeps

A reload rebuilds three kinds of DI instance, and keeps everything else:

- instances of classes whose module was edited, or imports an edited file;
- every singleton that takes `Moost` or an adapter (`MoostHttp`, …) as a constructor parameter — the app itself is new on every reload;
- every singleton that depends on one of the above, however deep: `Moost → Database → Repository → Worker` rebuilds all four.

Everything rebuilt is disposed first (above). A singleton with none of those dependencies is **kept**: the same instance serves the new app and is not disposed.

| You want                                                  | Do this                                                                                                     |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| A per-boot owner (DB connection, queue consumer, cache) rebuilt on every reload | Give it a `Moost` constructor parameter (`constructor(app: Moost)`) and a `@MoostDispose` hook. Its consumers follow automatically. |
| A process-lifetime singleton (telemetry, metrics exporter) kept across reloads | Keep `Moost`, adapters and rebuilt classes out of its constructor. If it is a registered controller, its [`@MoostInit`](/moost/app-init) hook runs **again** on the same instance for every new app — make the hook idempotent. |
| A class-level `@Provide` factory to see the new boot      | Nothing — factories run again after every reload, so every instance built for the new app receives the new value (a kept instance keeps what it was injected). Read the current state inside the factory (`() => currentSpace().get(Model)`), don't capture it at decoration time. |

Dependency-based rebuilding reads constructor parameter types from decorator metadata. A parameter whose type is imported with `import type` (or is an interface) is invisible to it, so the consumer is kept even when its dependency is rebuilt — import classes you inject as values.

::: info Since 0.6.38
Earlier versions stopped the cascade after one level: in `Moost → Database → Repository → Worker` the `Worker` survived holding the disposed `Database` (on every other reload). And with `@prostojs/infact` 0.5.0 a class-level `@Provide` factory ran once per process, so a controller rebuilt after a reload was still injected what the first boot resolved — for example a table bound to a closed connection. 0.6.38 depends on infact 0.5.1, which re-runs factories after each reload.
:::

For production shutdown, where no reload ever happens, call [`app.disposeOnSignals()`](/moost/app-dispose#graceful-shutdown) in the entry: it runs the same hooks on SIGTERM/SIGINT, and unlike a hand-written `process.once(...)` it registers one listener per process, so the dev server re-executing the entry re-targets it instead of stacking one handler per reload. Under the dev server Vite's own SIGTERM listener closes the server and exits, which can race `dispose()`; SIGINT (Ctrl-C) is untouched by Vite.

Files outside the entry graph never touch the Moost app:

- **Client-side modules** (composables, stores, anything only the browser imports) keep Vite's regular HMR — browser updates flow as in any Vite app while the API keeps serving.
- **SSR render modules** (the `ssrEntry` graph) are refreshed by Vite's default invalidation, so the next server-rendered page picks them up without rebooting Moost.

If a server edit breaks the app (e.g. a syntax error), requests matching `prefix` (or all requests when no `prefix` is set) answer `502` with the load error instead of falling through to the frontend; the next edit retries the reload.

### Waiting for `init()`

A reload is not finished when the entry has *run* — it is finished when the app is **initialized**. The plugin captures the promise your entry's `app.init()` returns and awaits it as part of the boot, so a request is never answered by a half-bound app: every route is mounted and every [`@MoostInit`](/moost/app-init) hook has run before the first request gets through (the same holds for the server's very first boot).

That is why the documented entry order — `app.adapter(http).listen(port)` followed by an un-awaited `app.init()` — is fine under the dev server: the plugin, not the entry, owns the waiting.

If `init()` **rejects** (a bind error, a DI audit error, a throwing `@MoostInit` hook), the plugin logs `✖️  Moost app init failed: <message>` and answers `502` with `Moost app failed to load: <message>` for matching requests — even though `listen()` already handed it a middleware. Without that gate a half-booted app answers `200` for the handful of routes bound before the failure and lets the rest fall through to the SPA fallback. The next edit retries, exactly like a failed reload.

::: info Since 0.6.37
Earlier versions awaited only the entry's module evaluation: a rejecting `init()` went unobserved, and requests could be served by a partially bound app.
:::

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
| `onEject` | `function` | — | Veto hook per HMR ejection candidate `(instance, depClass)` — return `false` to keep the instance (it is then not ejected and not [disposed](/moost/app-dispose)) |
| `ssrFetch` | `boolean` | `true` | Enable [SSR local fetch](/webapp/fetch) interception |
| `ssrFetchForwarding` | `boolean` | `true` | Run each SSR render inside an HTTP context seeded from the page request — SSR self-calls inherit the [viewer's identity](/webapp/fetch#ssr-viewer-identity) and their `Set-Cookie` reaches the page response |
| `middleware` | `boolean` | `false` | Run Moost as Connect middleware |
| `prefix` | `string \| string[]` | — | URL mount(s) for middleware mode — requests outside every mount skip the Moost router (fast path); when omitted, every request enters Moost first and unmatched routes fall through to the frontend |
| `ssrEntry` | `string` | — | Vue/React SSR entry module (e.g. `'/src/entry-server.ts'`) |
| `ssrOutlet` | `string` | `'<!--ssr-outlet-->'` | HTML placeholder for SSR-rendered content |
| `ssrState` | `string` | `'<!--ssr-state-->'` | HTML placeholder for SSR state transfer script |
| `ssrHead` | `string` | `'<!--ssr-head-->'` | HTML placeholder for SSR-rendered `<head>` tags — place inside `<head>` (see [render contract](/webapp/ssr#the-render-contract)) |
| `serverEntry` | `string` | — | Custom production server entry file (e.g. `'./server.ts'`) |
| `ssrExternal` | `string[]` | — | Packages to keep external in the middleware-mode SSR build (concatenated with `cfg.ssr.external`). See [SSR Bundle Size](#ssr-bundle-size). |
| `ssrExternalCheck` | `boolean \| { packages?: (string \| RegExp)[] }` | `true` | Warn after the middleware-mode SSR build when an externalized package depends on a **bundled** shared-state package (`moost`, `@moostjs/*`, `wooks`, `@wooksjs/*`, `@atscript/*` by default). `{ packages: [...] }` watches more — an exact name (`'lodash'`), a scope prefix (`'@acme/'`) or a `RegExp`. See [Keep consumers on the same side](#keep-consumers-on-the-same-side-as-the-shared-packages). |

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

**Don't externalize:** workspace packages, anything that keeps module-level state — `Symbol()` slot keys, registries, class identity (Moost, wooks, `@atscript/*`) — anything not reliably hoisted by pnpm.

You can also opt out of bundle-everything entirely by setting `ssr.noExternal` to an explicit list — the plugin honors it, appending `/^@moostjs\/vite($|\/)/` (so its `define:` substitutions still land) plus, unless you externalize the runtime yourself, the moost/wooks runtime patterns described below:

```ts
ssr: {
  noExternal: [/^@aooth\//, /^@atscript\//],
  external: ['vue', 'vue-router'],
}
```

When you use an explicit `noExternal` list, the plugin automatically keeps the **moost/wooks runtime** (`moost`, `@moostjs/*`, `@wooksjs/*`, `wooks`) bundled alongside your listed packages, so there is always a single runtime instance. Without this, any listed package that imports `@wooksjs/*` (e.g. `@aooth/*` and other `.as`-shipping libs) would pull in a second copy while externalized `moost` uses the first — splitting the event context so `useRequest()` / `useHeaders()` / `useAuthorization()` read `undefined` in production only. If you would rather externalize the runtime instead, list it under `ssr.external` (`['@wooksjs/event-http', '@wooksjs/event-core', 'wooks', …]`) and add those packages as direct dependencies — the plugin detects an externalized runtime and leaves your all-external setup intact.

### Keep consumers on the same side as the shared packages

The guard guarantees a single runtime **instance**, not a single **graph** — and it works in one direction only: it stops a *bundled* package from dragging in a second runtime copy next to an *external* one. The mirror image is on you. With an explicit `noExternal` list, every dependency you did not list is externalized — including libraries that merely *call* wooks composables (`useRequest()`, `useHeaders()`, `useCookies()`, `useAuthorization()`) without shipping `.as` source. Such a library resolves its own `@wooksjs/*` from `node_modules`, reads a slot the bundled runtime never wrote, and fails with the same production-only error. The same split appears if you put such a library in `ssr.external` while keeping the bundle-everything default.

**It is not only the runtime.** Any package that keeps module-level state breaks the same way when Node loads a second copy of it: the moost/wooks runtime (Symbol slot keys, DI registries) and the `@atscript/*` family alike — `@atscript/core`, `@atscript/typescript`, `@atscript/db` and its adapters, moost-db, the UI packages — which additionally rely on **class identity**. Bundle `@atscript/db` while leaving `@atscript/db-mysql` (or `@atscript/db-sqlite`) external, and the adapter's `instanceof` check runs against the class from *its own* copy: a view declared through the bundled copy is not recognized, the adapter creates an empty physical table in its place, and reads return nothing — no error, no stack trace.

**The rule, in one sentence: a shared-state package is either entirely bundled or entirely external, together with everything that depends on it.**

The outcomes at a glance:

| `vite.config.ts` | Shared-state package | A package that depends on it | Result |
|---|---|---|---|
| no `ssr` block, or `ssr.external` only (what `create-moost` emits) | bundled | bundled | ✅ one instance |
| `noExternal` list **and** the runtime in `ssr.external` | external | external | ✅ one instance — Node dedupes by realpath, so keep one version of each package in the tree |
| `noExternal` list, runtime **not** externalized, consumer not listed | bundled (by the guard) | external | ❌ split — production only |
| bundle-everything default (or a `noExternal` list) **and** `@atscript/db-mysql` / `@atscript/db-sqlite` in `ssr.external` | `@atscript/db` bundled | adapter external | ❌ split — the adapter's `instanceof` check fails, so it creates an empty table where a managed view was declared and reads return nothing |

**Rule of thumb — classify by what a package does, not what it is.** If `pnpm why @wooksjs/event-http` (or `pnpm why moost`, `pnpm why @atscript/db`) lists a package as a dependent, that package shares module state: with an explicit `noExternal` list it must be *listed*; with the shared package external it must stay *external*. Never split. A package can be publicly published and semver-stable and still be unsafe to externalize on its own.

**The build checks this for you.** After the SSR build, the plugin compares both sides of the output: the packages it inlined into `dist/server` and the bare imports left in it (those are the externalized packages, whose dependency trees it walks). When an external package — or one of its transitive dependencies — depends on a **bundled** watched package, `vite build` prints a warning naming the package and the fix:

```
[moost-vite] These externalized packages depend on packages that are bundled into dist/server, so Node will load a second copy of them from node_modules:
  - some-auth-lib depends on @wooksjs/event-http (bundled)
  - @atscript/db-mysql depends on @atscript/db (bundled)
Two copies of a package split its module state — event-context slots, DI registries and class identity (instanceof) stop matching across the boundary, in production only. Symptoms: "Cannot read properties of undefined (reading 'headers')" inside a wooks composable, or a database adapter creating an empty table where a managed view was declared.
Fix: keep each shared package and everything that depends on it on the same side — add 'some-auth-lib', '@atscript/db-mysql' to ssr.noExternal (or drop them from ssr.external / ssrExternal), or externalize the whole family (for example every @atscript/* package, or the whole moost/wooks runtime) via ssr.external.
Set ssrExternalCheck: false in moostVite() to silence this check, or ssrExternalCheck: { packages: [...] } to watch more packages.
```

Watched by default: `moost`, `@moostjs/*`, `wooks`, `@wooksjs/*` and `@atscript/*`. Any other package of yours that keeps module-level state belongs in the watched set too — `ssrExternalCheck: { packages: ['some-registry-lib', '@acme/', /^my-lib-/] }` (exact name, scope prefix, or `RegExp`). `ssrExternalCheck: false` silences the check entirely.

To verify by hand — or on a plugin version without the check — list what `dist/server` still imports from `node_modules`:

```bash
pnpm build
grep -rhoE 'from *"[^"./][^"]*"' dist/server --include='*.js' | sed 's/from *"//; s/"$//' | sort -u
# Anything here that depends on a bundled shared-state package (moost/wooks, @atscript/*) is a split.
# Native drivers and leaf libraries are expected.
```

**Validate the packed artifact.** Source-level tests all share one module graph, so they can never see an identity split — only the installed build can. Install the built app with its production dependencies from the same lockfile (copy the output plus `package.json` / lockfile and run `pnpm install --prod --frozen-lockfile`, or `pnpm pack` and install the tarball), start the emitted server, and hit one route per adapter: a request that reads headers/auth, and one that reads and writes through each database adapter. A split shows up there and nowhere else.

::: warning Symptom
`TypeError: Cannot read properties of undefined (reading 'headers')` — or `(reading 'authorization')`, `(reading 'cookie')`, any header name, depending on which composable runs first — thrown from inside a wooks composable, in production only while `vite serve` is healthy, means two copies of the wooks runtime are loaded. The silent variant: a database adapter creates an **empty table** where a managed view was declared (its `instanceof` check saw a class from the other copy), so queries return nothing and no error is raised. Fix the externalization split above; the code is fine.
:::
