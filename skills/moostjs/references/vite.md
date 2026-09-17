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

| Mode              | Config                       | Build output                                                                 |
| ----------------- | ---------------------------- | ---------------------------------------------------------------------------- |
| Backend (default) | `moostVite({ entry })`       | Moost is the server; single `dist/` bundle                                   |
| Middleware        | `+ middleware: true, prefix` | Vite serves frontend, Moost serves `prefix/*`; `dist/client` + `dist/server` |
| SSR               | middleware `+ ssrEntry`      | adds server-side render; forces `appType: 'custom'`                          |
| SPA               | middleware, no `ssrEntry`    | static + API, client renders; prod server still generated                    |

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

Moost handles requests matching `prefix`; everything else falls through to Vite (frontend, static, HMR). `prefix` is a single mount or a list (`['/api', '/.well-known']`), each entry normalized to leading-slash / no-trailing-slash; it is a pure fast-path skip, identical in dev and the built prod server. Omitting `prefix` routes every request through Moost first with unmatched routes falling through to the frontend — same contract in dev and prod. (Up to and including `0.6.26`: single string only, and the prod server silently defaulted an omitted `prefix` to `'/api'` — set it explicitly on those versions.)

## SSR / SPA mode

```ts
moostVite({
  entry: '/src/main.ts',
  middleware: true,
  prefix: '/api',
  ssrEntry: '/src/entry-server.ts', // omit for SPA
})
```

`vite build` emits three bundles in one pass: **client** (`dist/client/`), **ssr** render fn (`dist/server/ssr/`), **server** (`dist/server/server.js`). With [SSR local fetch](event-http.md) (default), `fetch('/api/...')` during SSR calls Moost in-process — no loopback — and carries the page viewer's identity (`ssrFetchForwarding`, see [Options](#options)). SSR vs SPA differ only by the presence of `ssrEntry`.

### Render contract

`entry-server.ts` exports `render(url, ctx?)` returning `TSSRRenderResult` (types from `@moostjs/vite/server`) — `{ html, state?, head?, status?, headers? }`; only `html` required. `ctx` (`TSSRRenderContext`, added after `0.6.30`; optional — `render(url)` entries unchanged) describes the incoming page request: `ctx.headers` (raw request headers — locale, geo, A/B cookies), `ctx.method`, `ctx.req` (raw `IncomingMessage` escape hatch). Do NOT thread `ctx` headers into SSR fetches for auth — identity forwarding is automatic (see `ssrFetchForwarding` in [Options](#options)). Each field maps to a substitution or response step (every marker is a plain string-replace — a marker missing from `index.html` is a silent no-op):

| Field     | Effect                                                                                                                                                                                                               |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `html`    | replaces `ssrOutlet` marker (`<!--ssr-outlet-->`) in `<body>`                                                                                                                                                        |
| `state`   | wrapped as `<script>window.__SSR_STATE__=…</script>` at `ssrState` marker                                                                                                                                            |
| `head`    | inserted verbatim at `ssrHead` marker (`<!--ssr-head-->`) — put the marker in `<head>` for per-page `<title>`/meta/canonical/OG/JSON-LD SEO; pass a head-manager string (e.g. unhead `renderSSRHead(head).headTags`) |
| `status`  | `res.statusCode` (default `200`) — return `404` for an unknown slug (real 404 beats soft-404 for crawlers/CDNs), `301` for a redirect                                                                                |
| `headers` | extra response headers (`cache-control`; or `location` with `status: 301`) — applied **after** the default `Content-Type: text/html`, so a render can override it                                                    |

`head`/`status`/`headers` + the `<!--ssr-head-->` marker/`ssrHead` option were added after `0.6.28`; `≤ 0.6.28` honors only `{ html, state }` (extra fields ignored — a soft-404 renders with `200`, no head seam). Backwards compatible: an old `{ html }` / `{ html, state }` render is unchanged.

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

`createSSRServer` handles dev/prod automatically. Optional `TSSRServerOptions` override what the plugin configured: `entry`, `ssrEntry`, `prefix`, `port`, `clientDir`, `ssrOutlet`, `ssrState`, `ssrHead`, `ssrFetchForwarding` (prod falls back to build-time baked values). The returned `TSSRServer` exposes `use(middleware)` (Connect-style) and `listen(port?)`. `serverEntry` is used only during `vite build`. `createSSRServer({ entry: () => import('./src/main') })` is an escape hatch that bundles the entry via the function instead of the baked define.

## SSR externalization & single-instance guard

The moost/wooks runtime relies on per-module `Symbol` slot keys (`cached()`/`key()`); the `@atscript/*` family (`core`, `typescript`, `db` + adapters, moost-db, UI) relies on registries and class identity (`instanceof`). Two copies of any such shared-state pkg = split state = `undefined` reads / failed `instanceof`, prod only. **Rule: a shared-state package is either entirely bundled or entirely external, together with everything that depends on it.** Invariants:

1. **Default build = `ssr.noExternal: true`** — every dep is bundled → single instance. Dev (`vite serve`) keeps a selective allowlist (Vite's ESM-only SSR runner can't eval CJS-only deps like `@vue/server-renderer`).
2. **Explicit `ssr.noExternal` list** (e.g. to bundle `.as`-shipping packages like `@aooth/*` / `@atscript/*` for `unplugin-atscript`) externalizes everything _not_ listed.
3. **Single-instance guard** — when you set an explicit `noExternal` list at build time, the plugin auto-force-bundles `moost`, `@moostjs/*`, `@wooksjs/*`, `wooks` alongside your list, so the runtime stays one instance and `useRequest()` / `useHeaders()` / `useAuthorization()` keep working in prod.
4. **Don't externalize the runtime piecemeal.** A bundled listed package importing `@wooksjs/*` while `moost` stays external is the split. If you must externalize, externalize the **whole** runtime (`@wooksjs/event-http`, `@wooksjs/event-core`, `wooks`, …) **and** add them as direct deps — the guard detects an externalized runtime (any match in `ssr.external` / `ssrExternal`) and backs off.
5. **Shrink `dist/server/`** by externalizing stable single-canonical-build libs only: `ssr.external` / `ssrExternal: ['vue', 'vue-router', '@vue/server-renderer']`. Never externalize Symbol-slot-key packages (moost, wooks) or anything not reliably pnpm-hoisted.
6. **The guard is one-directional — consumers are on you.** With a shared-state pkg bundled (default, or guard under an explicit list), any dep left external that _depends on_ it loads its own copy from `node_modules` → split. Two shapes: (a) a lib that merely calls `useRequest()`/`useHeaders()` left unlisted/`ssr.external` while the runtime is bundled; (b) `@atscript/db` bundled (the default) + `@atscript/db-mysql` / `@atscript/db-sqlite` in `ssr.external` — the adapter's `instanceof AtscriptDbView` runs against the class from ITS copy, fails for a view defined through the bundled copy, and it silently creates an **empty physical table** where the managed view was declared (reads return nothing, no error). Rule: whatever `pnpm why @wooksjs/event-http` / `pnpm why moost` / `pnpm why @atscript/db` lists must sit on the same side as the pkg itself — in `noExternal` when bundled, external when the whole family is external. Never mix. `ssr.external` on such a lib under the bundle-everything default is the same bug.
7. **Build-time check (after 0.6.35).** Post-SSR-build the plugin diffs both sides of the output: chunk `moduleIds` under `node_modules` (incl. pnpm store paths) = the bundled pkgs, bare imports left = the externals (dep trees walked). External (or transitive dep of one) depending on a **bundled** watched pkg ⇒ `[moost-vite] These externalized packages depend on packages that are bundled into dist/server…` naming pkg, the `(bundled)` dep and the fix. Watched by default: `moost`, `@moostjs/*`, `wooks`, `@wooksjs/*`, `@atscript/*`; `ssrExternalCheck: { packages: ['some-registry-lib', '@acme/', /^my-lib-/] }` (exact name / scope prefix / RegExp) watches more, `false` silences. NOT skipped when you externalize the runtime yourself — the check reads what was actually bundled. Treat the warning as a build failure. Manual check: `grep -rhoE 'from *"[^"./][^"]*"' dist/server --include='*.js' | sort -u` — anything listed that depends on a bundled shared-state pkg is a split.
8. **Symptom → diagnosis.** `TypeError: Cannot read properties of undefined (reading 'headers')` (or any header name) from inside a wooks composable, prod only, `vite serve` fine ⇒ duplicated runtime. Silent variant: an adapter created an empty table where a managed view was declared / reads return nothing ⇒ duplicated `@atscript/db`. Fix externalization, not the code. Source-level tests share ONE module graph and can never see an identity split: validate the packed artifact — install the build with prod deps from the same lockfile (`pnpm install --prod --frozen-lockfile` in a copy, or `pnpm pack` + install), run the emitted server, hit one route per adapter.

## Options

| Option                                      | Type                                             | Default                                                      | Notes                                                                                                                                                                                                                                                                          |
| ------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `entry`                                     | `string`                                         | —                                                            | required; Moost app entry. `/src/...` (root-rel) or `./src/...`                                                                                                                                                                                                                |
| `middleware`                                | `boolean`                                        | `false`                                                      | run Moost as Connect middleware behind Vite                                                                                                                                                                                                                                    |
| `prefix`                                    | `string \| string[]`                             | —                                                            | URL mount(s) for middleware mode (fast-path skip outside every mount); omitted → all requests enter Moost first, unmatched fall through (dev and prod alike)                                                                                                                   |
| `ssrEntry`                                  | `string`                                         | —                                                            | Vue/React SSR entry (e.g. `/src/entry-server.ts`)                                                                                                                                                                                                                              |
| `ssrOutlet` / `ssrState` / `ssrHead`        | `string`                                         | `<!--ssr-outlet-->` / `<!--ssr-state-->` / `<!--ssr-head-->` | HTML placeholders (put the `ssrHead` marker in `<head>`; see [Render contract](#render-contract))                                                                                                                                                                              |
| `serverEntry`                               | `string`                                         | —                                                            | custom prod server entry; auto-generated when omitted                                                                                                                                                                                                                          |
| `ssrExternal`                               | `string[]`                                       | —                                                            | packages to keep external in middleware SSR build (≡ `ssr.external`)                                                                                                                                                                                                           |
| `ssrExternalCheck`                          | `boolean \| { packages?: (string \| RegExp)[] }` | `true`                                                       | after `0.6.35`: warn post-build when an externalized pkg depends on a **bundled** shared-state pkg (`moost`, `@moostjs/*`, `wooks`, `@wooksjs/*`, `@atscript/*`); `packages` adds names / `'@acme/'` prefixes / RegExps (invariant 7)                                          |
| `ssrFetch`                                  | `boolean`                                        | `true`                                                       | in-process `fetch('/api/...')` during SSR                                                                                                                                                                                                                                      |
| `ssrFetchForwarding`                        | `boolean`                                        | `true`                                                       | run each SSR render inside an HTTP context seeded from the page request (after `0.6.30`): SSR self-calls inherit viewer identity headers ([forwarding rules](event-http.md#local-fetch--ssr)) and their `Set-Cookie` reaches the page response; `false` → anonymous self-calls |
| `sourcemap`                                 | `boolean`                                        | `true`                                                       | both modes; in middleware mode controls the `dist/server` SSR build sourcemaps                                                                                                                                                                                                 |
| `port`/`host`/`outDir`/`format`/`externals` | —                                                | —                                                            | **backend mode only**; middleware mode uses `vite.config`                                                                                                                                                                                                                      |
| `onEject`                                   | `function`                                       | —                                                            | veto hook per HMR ejection candidate `(instance, depClass)`; ejection only when absent or returning `true` — return `false` to keep the instance (kept ⇒ not ejected and not disposed)                                                                                         |

## Key imports

```ts
import { moostVite } from '@moostjs/vite' // vite.config.ts plugin
import { createSSRServer } from '@moostjs/vite/server' // custom dev/prod server entry
import type { TSSRRender, TSSRRenderContext, TSSRRenderResult } from '@moostjs/vite/server' // render(url, ctx?) contract
```

## Gotchas

- Middleware mode emits the Moost `entry` as `dist/server/<name>.js`; if the basename is `server` it's keyed `moost-entry` to avoid the reserved server-entry key.
- Under an explicit `noExternal` list, **never** externalize `@wooksjs/*` / `moost` piecemeal — the guard force-bundles them; a partial external split makes `useRequest()` etc. read `undefined` in prod only (dev dedupes via the SSR module runner, so it passes locally). The inverse split (bundled shared pkg, external lib depending on it) is NOT guarded — invariant 6; the build warns (invariant 7).
- The guard covers moost/wooks only. `@atscript/*` is watched by the check but never force-bundled: `ssr.external: ['@atscript/db-mysql']` (a common "keep the native driver out of the bundle" move) while `@atscript/db` stays bundled splits class identity — the adapter creates an **empty table instead of the view** and reads return nothing, with no error anywhere. Externalize the whole family (`@atscript/db` too, added as a direct dep) or nothing.
- `create-moost`'s SSR template ships **no `ssr` block** on purpose (bundle-everything). To externalize a native driver, add `ssr.external` alone — don't introduce a `noExternal` list for that; a list flips every unlisted dep to external.
- `serverEntry` is build-only. For custom middleware in dev, run `tsx server.ts` instead of `vite`.
- `ssrEntry` forces `appType: 'custom'` (Vite stops serving HTML; the plugin's SSR fallback takes over).
- SEO head tags need the `<!--ssr-head-->` marker **inside `<head>`** of `index.html`; without it `render().head` is silently dropped (string-replace no-op, no error). Same for a `status: 404`/redirect that never fires because you're on `≤ 0.6.28` — diagnose a soft-404-served-as-200 or missing `<title>`/meta as an out-of-date `@moostjs/vite`.
- Backend-mode-only options (`port`, `host`, `outDir`, `format`, `externals`) are ignored in middleware mode — but `sourcemap` is NOT backend-only: in middleware mode it sets the `dist/server` SSR build's sourcemaps (default `true`).
- HMR is scoped to the **Moost entry graph** (any file type the server imports, not just `.ts`): an entry-graph edit ejects the affected DI instances + Wooks router/Mate caches (tracked via `__vite_id` decorators) and re-imports the entry, re-initializing the whole app on the next request — one mechanism for controllers, data-models and providers alike. No restart.
- Every instance the HMR eject removes is **disposed** before the entry re-imports: its [`@MoostDispose`](core.md#app-dispose-moostdispose) hooks (or `Symbol.asyncDispose`/`Symbol.dispose`) are awaited, so the replacement never races the old one for the same connection/consumer/handle. A throwing hook logs a warning and the reload continues. An instance kept by an `onEject` veto is NOT disposed (it stays live and in use).
- A resource accumulating one copy per dev reload (file descriptors piling up until `SQLITE_BUSY`, two consumers in one group, duplicate timers) means its owner has no `@MoostDispose` hook — process signals never fire on HMR, so `process.on('SIGTERM')` cleanup is dead code in dev.
- Files **outside** the entry graph never reload Moost: client-only modules keep Vite's regular browser HMR; `ssrEntry` render-graph modules get Vite's default invalidation so the next SSR render is fresh. Versions ≤ 0.6.25 hijacked ANY `.ts` change — editing a client-only `.ts` in middleware+SSR mode killed `/api/*` (served `index.html`) until the next server-graph edit or a restart, and also suppressed the browser HMR update for that file; diagnose those symptoms as an out-of-date plugin.
- Root-mounted routes (e.g. `/.well-known/*` for OAuth discovery) registering fine but 404ing in prod while working in dev → out-of-date `@moostjs/vite` (≤ `0.6.26`: `prefix` was single-string only and the prod server silently defaulted an omitted `prefix` to `'/api'`). Current versions: use `prefix: ['/api', '/.well-known']` or omit `prefix`.
- A server edit that fails to load (syntax error, bad import) makes requests matching `prefix` (all requests when no `prefix` is set) answer `502` with the error message (instead of falling through to the SPA/SSR fallback); the next edit retries.
- SSR self-calls hitting per-IP rate limits / auth guards as `127.0.0.1`-anonymous → `@moostjs/vite` ≤ 0.6.30 (no `ssrFetchForwarding`). Worse: on those versions forwarding **accidentally** worked in dev and in prod-without-`prefix` (render ran inside the page's context via the no-match path) but broke once `prefix` was set — auth-aware SSR passing in dev and failing in prod is that version gap, not app code. Current versions forward deterministically in every mode.
- Editing an entry-graph module in middleware+SSR dev re-imports the entry, which re-runs `app.listen()`; the plugin re-captures the patched `MoostHttp.listen()` on each reload so it never re-binds the dev port. Diagnose a dev `EADDRINUSE` on HMR as an out-of-date `@moostjs/vite` (versions ≤ 0.6.24 crashed here).

## See also

- [core.md](core.md#app-dispose-moostdispose) — `@MoostDispose`, the hook HMR ejects run.
- [event-http.md](event-http.md) — MoostHttp, local fetch / SSR in-process routing.
- Docs: <https://moost.org/webapp/vite>, <https://moost.org/webapp/ssr>.
