import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { resolve } from 'node:path'
import type { EnvironmentModuleGraph, PluginOption, ResolvedConfig } from 'vite'
import { createServerModuleRunner } from 'vite'
import MagicString from 'magic-string'

import { createAdapterDetector } from './adapter-detector'
import { captureMoostInit, patchMoostHandlerLogging } from './moost-logging'
import { moostRestartCleanup } from './restart-cleanup'
import {
  bundledPackagesFromModuleIds,
  compilePackagePatterns,
  findSplitPackages,
  formatSplitPackagesWarning,
  npmPackageName,
  RUNTIME_PACKAGE_PATTERNS,
} from './ssr-externals-check'
import {
  DEFAULT_SSR_HEAD,
  DEFAULT_SSR_OUTLET,
  DEFAULT_SSR_STATE,
  entryBasename,
  gatherAllImporters,
  getExternals,
  getLogger,
  matchesPrefix,
  normalizePrefixes,
  PLUGIN_NAME,
  renderSSRPage,
  sendSSRResponse,
} from './utils'
import type { TSSRHttpContextRunner, TSSRRender } from './utils'

/** A simple request-response middleware type for Node’s http module. */
type TMiddleware = (req: IncomingMessage, res: ServerResponse) => any

/** Regex checks */
const REG_HAS_EXPORT_CLASS = /(^\s*@(Injectable|Controller)\()/m
const REG_REPLACE_EXPORT_CLASS = /(^\s*@(Injectable|Controller)\()/gm

export interface TMoostViteDevOptions {
  /**
   * The entry file for the application.
   * This file serves as the main entry point for the build process and SSR server.
   *
   * Example: './src/main.ts'
   */
  entry: string

  /**
   * The port number for the Vite dev server.
   *
   * Default: `3000`.
   */
  port?: number

  /**
   * The hostname or IP address for the Vite dev server.
   * If not specified, defaults to `'localhost'`.
   *
   * Example: '0.0.0.0'
   */
  host?: string

  /**
   * The output directory for the build artifacts.
   *
   * Default to: `'dist'`.
   */
  outDir?: string

  /**
   * The output format for the build artifacts.
   * - `'cjs'`: CommonJS, suitable for Node.js environments.
   * - `'esm'`: ES Module, suitable for modern environments.
   *
   * Default: `'esm'`.
   */
  format?: 'cjs' | 'esm'

  /**
   * Whether to generate source maps for the build output.
   * Source maps are useful for debugging purposes by mapping minified code back to the original source.
   *
   * Default: `true`.
   */
  sourcemap?: boolean
  /**
   * Configuration for defining external dependencies during the build process.
   *
   * This helps in excluding certain modules from the bundled output, reducing the bundle size and
   * allowing them to be resolved at runtime instead.
   *
   * Default: `true`.
   */
  externals?:
    | {
        /**
         * Whether to exclude Node.js built-in modules (e.g., `fs`, `path`, `node:fs`) from the build output.
         * If `true`, all Node.js built-ins will be marked as external.
         * Default: `false`.
         */
        node?: boolean
        /**
         * Whether to exclude workspace dependencies (e.g., packages marked with `workspace:*` in `package.json`) from the build output.
         * If `true`, all workspace dependencies will be marked as external.
         * Default: `false`.
         */
        workspace?: boolean
      }
    | boolean
  onEject?: (instance: object, dependency: Function) => boolean
  /**
   * Whether to enable local fetch interception for SSR.
   * When enabled, `fetch('/path')` calls are routed to the Moost HTTP adapter
   * in-process instead of making a network request.
   *
   * Set to `false` when running behind Nitro or another framework that
   * manages fetch routing itself.
   *
   * Default: `true`.
   */
  ssrFetch?: boolean
  /**
   * Run each SSR render inside an HTTP event context seeded from the incoming
   * page request. SSR-time `fetch('/api/...')` self-calls then inherit the
   * viewer's identity headers (authorization, cookie, accept-language,
   * x-forwarded-for, x-request-id — see the HTTP adapter's `forwardHeaders`
   * option) instead of arriving anonymous, and `Set-Cookie` headers they
   * produce are drained onto the page response. Applies in dev and is baked
   * into the generated production server.
   *
   * Set to `false` to keep SSR self-calls anonymous.
   *
   * Default: `true`.
   */
  ssrFetchForwarding?: boolean
  /**
   * Run Moost as Connect middleware instead of taking over the server.
   * When enabled, Moost runs first and unmatched requests fall through to
   * Vite's default handler (static assets, Vue/React pages, HMR client).
   * With `prefix` configured, requests outside the mount(s) skip the Moost
   * router entirely (fast path).
   *
   * Use this for fullstack apps where Vite serves the frontend (Vue, React, etc.)
   * and Moost handles API routes.
   *
   * Default: `false`.
   */
  middleware?: boolean
  /**
   * URL mount(s) for Moost routes in middleware mode — a single prefix or a
   * list of prefixes. Requests outside every mount skip the Moost router and
   * go straight to the frontend handler (an optimization/guard, in both dev
   * and the generated prod server). When omitted, every request enters Moost
   * first and unmatched routes fall through to the frontend.
   * Ignored when `middleware` is `false`.
   *
   * Example: `'/api'` or `['/api', '/.well-known']`
   */
  prefix?: string | string[]
  /**
   * Vue/React SSR entry module path. Used by the SSR server helper
   * (`@moostjs/vite/server`) for server-side rendering.
   *
   * Example: `'/src/entry-server.ts'`
   */
  ssrEntry?: string
  /**
   * HTML placeholder for SSR-rendered content.
   * Default: `'<!--ssr-outlet-->'`
   */
  ssrOutlet?: string
  /**
   * HTML placeholder for SSR state transfer script.
   * Default: `'<!--ssr-state-->'`
   */
  ssrState?: string
  /**
   * HTML placeholder for SSR-rendered `<head>` tags (`<title>`, `<meta>`,
   * canonical, Open Graph, JSON-LD). Place the marker inside `<head>` and return
   * `head` from `render()` to inject per-page tags. Default: `'<!--ssr-head-->'`
   */
  ssrHead?: string
  /**
   * Path to a custom server entry file (e.g., `'./server.ts'`).
   * When provided, this file is used as the production server build entry.
   * When omitted in middleware mode, the plugin auto-generates a minimal
   * production server that serves static files + Moost API (+ SSR if configured).
   */
  serverEntry?: string
  /**
   * Packages to keep external in the production SSR bundle.
   *
   * In middleware mode during `vite build`, the plugin defaults to
   * `ssr.noExternal: true` — every dependency is bundled into the SSR
   * output. This avoids two common failure modes:
   *  - duplicate module instances of packages like `@wooksjs/event-http`
   *    whose Symbol-identity slot keys do not match across instances;
   *  - pnpm strict-resolution failures where externalized transitive deps
   *    are not hoist-accessible from the consumer's `node_modules`.
   *
   * Use `ssrExternal` to opt specific packages OUT of bundling — native
   * bindings (`mongodb`, `ioredis`, anything loading `.node` modules), or
   * stable upstream libraries you'd rather resolve from `node_modules` at
   * runtime (e.g. `['vue', 'vue-router', '@vue/server-renderer']` to drop
   * a megabyte from `dist/server/`).
   *
   * Equivalent to `cfg.ssr.external` — entries from both are concatenated.
   * The standalone `cfg.ssr.external` field works the same way; this
   * plugin option exists for symmetry with `entry`/`ssrEntry`/`prefix`.
   *
   * Only applied in `middleware: true` mode during `vite build`. Dev
   * (`vite serve`) is unaffected: Vite's default externalizer continues
   * to handle node_modules, which is required so CJS-only packages like
   * `@vue/server-renderer` can be loaded by Node's ESM/CJS interop
   * instead of evaluated by Vite's ESM-only SSR module runner.
   */
  ssrExternal?: string[]
  /**
   * Verify the production SSR build for split shared-state packages.
   *
   * After the middleware-mode `vite build`, the plugin compares what ended up
   * inside `dist/server` (the bundled packages) with the bare imports left in
   * the output (the externalized ones) and walks the externals' dependency
   * trees. When an external package depends on a bundled watched package, Node
   * loads a second copy of it at runtime — event-context slots, DI registries
   * and `instanceof` checks stop matching in production only — so the build
   * prints a warning naming the package and the fix.
   *
   * Watched by default: `moost`, `@moostjs/*`, `wooks`, `@wooksjs/*` and
   * `@atscript/*`. Pass `{ packages: [...] }` to watch more: an exact package
   * name (`'lodash'`), a scope/prefix ending with `/` (`'@acme/'`), or a
   * `RegExp`.
   *
   * Default: `true`. Set `false` to silence the check.
   */
  ssrExternalCheck?: boolean | TSSRExternalCheckOptions
}

/** Extra packages the SSR split check should watch on top of its defaults. */
export interface TSSRExternalCheckOptions {
  /**
   * Package names (`'lodash'`), scope/prefix strings ending with `/`
   * (`'@acme/'`) or `RegExp`s, added to the watched set.
   */
  packages?: (string | RegExp)[]
}

/**
 * The main Vite plugin for integrating Moost applications.
 *
 * Features:
 * - **Adapter Detection**: Detects Moost adapter usage (`http`, `cli`, `wf`) and applies relevant configurations.
 * - **Dev Mode Middleware**:
 *   - Patches `MoostHttp.prototype.listen` to register a custom middleware for serving the app via Vite's dev server instead of binding to a port.
 *   - Handles Moost state cleanup and hot module replacement (HMR) during development.
 * - **Class Tracking**: Injects a `__VITE_ID()` decorator into exported classes to enable tracking and cleanup during hot reloads.
 * - **Externals Support**:
 *   - Allows marking Node.js built-in modules and dependencies from `package.json` (optionally excluding workspace dependencies) as external during builds.
 *   - Configured via the `externals` option, which helps reduce bundle size and ensures compatibility with runtime environments.
 * - **Build and Test Friendly**:
 *   - Avoids interfering with Vitest runs by skipping dev-specific behaviors during tests.
 *   - Ensures proper SSR entry setup and Rollup configurations for production builds.
 *
 * @param {TMoostViteDevOptions} options - Configuration options for the Moost Vite plugin.
 * @returns {PluginOption} The configured Vite plugin.
 */
const DEFAULT_SERVER_ENTRY_CODE = `import { createSSRServer } from '@moostjs/vite/server'
const app = await createSSRServer()
await app.listen()
`

function generatedServerEntry(root?: string): string {
  const dir = resolve(root || process.cwd(), 'node_modules', '.moost-vite')
  mkdirSync(dir, { recursive: true })
  const entryPath = resolve(dir, 'server-entry.mjs')
  writeFileSync(entryPath, DEFAULT_SERVER_ENTRY_CODE)
  return entryPath
}

/** Minimal shape of an emitted bundle entry — chunks carry both sides of the split check. */
interface TEmittedEntry {
  type: string
  imports?: string[]
  dynamicImports?: string[]
  moduleIds?: string[]
}

/**
 * Read the emitted SSR bundle: the packages inlined into it (from every chunk's
 * module ids) and the bare specifiers it still imports (the externalized ones).
 */
function scanSsrBundle(bundle: Record<string, TEmittedEntry>): {
  externalIds: Set<string>
  bundledPackages: Set<string>
} {
  const externalIds = new Set<string>()
  const moduleIds: string[] = []
  for (const chunk of Object.values(bundle)) {
    if (chunk.type !== 'chunk') {
      continue
    }
    moduleIds.push(...(chunk.moduleIds ?? []))
    for (const id of [...(chunk.imports ?? []), ...(chunk.dynamicImports ?? [])]) {
      // chunk-to-chunk imports are listed by file name — skip those
      if (!(id in bundle) && npmPackageName(id)) {
        externalIds.add(id)
      }
    }
  }
  return { externalIds, bundledPackages: bundledPackagesFromModuleIds(moduleIds) }
}

export function moostVite(options: TMoostViteDevOptions): PluginOption {
  const isTest = process.env.NODE_ENV === 'test'
  const isProd = process.env.NODE_ENV === 'production'
  const externals = options.externals ?? true

  // Normalize prefix entries: ensure leading slash, strip trailing slash
  const prefixes = normalizePrefixes(options.prefix)

  let moostMiddleware: TMiddleware | null = null
  let localFetchTeardown: (() => void) | null = null
  /**
   * Live ref to the booted MoostHttp instance (from Vite's SSR module graph).
   * Used to run SSR renders inside an HTTP event context (`withHttpContext`)
   * so SSR self-fetches inherit the page request's identity. Exposed on the
   * resolved config for the `createSSRServer()` dev branch; re-pointed on every
   * boot, cleared on eject.
   */
  const moostHttpRef: { current: TSSRHttpContextRunner | null } = { current: null }
  const ssrForwarding = options.ssrFetchForwarding !== false
  /**
   * Boot-identity stamps (dev-only "mongrel state" diagnostic — a stale pipeline
   * presents as security middleware silently switched off). `bootGeneration` is
   * bumped on every eject; `bootingGeneration` records which generation the
   * in-flight/most recent boot belongs to (set by runReload). When listen()
   * captures a middleware for a boot that is no longer current — e.g. a delayed
   * listen() from a torn boot racing a newer eject — it logs loudly.
   */
  let bootGeneration = 0
  let bootingGeneration = 0
  /** Whether the HTTP listen() patch has ever captured a middleware (i.e. this is an HTTP app). */
  let httpCaptured = false
  /**
   * The `app.init()` promises the current boot handed us (see `captureMoostInit`) —
   * several when one entry boots several apps, none for a boot that never calls
   * `init()`. Reset by `beginBoot()`, consumed by `settleBootInit()`.
   */
  let bootInitPromises: Promise<void>[] = []
  /** Module IDs awaiting DI cleanup — consumed in runReload; see ejectApp. */
  let pendingCleanup: Set<string> | null = null
  /** In middleware mode: maps req → next() for the onNoMatch callback */
  const pendingNextMap = new WeakMap<IncomingMessage, () => void>()

  const adapters = isTest
    ? []
    : [
        createAdapterDetector('http', (MoostHttp, moduleExports) => {
          MoostHttp.prototype.listen = function (...args: any[]) {
            logger.log(`🔌 ${__DYE_DIM__}Overtaking HTTP.listen`)
            if (bootingGeneration !== bootGeneration) {
              logger.error(
                `⚠️  A stale Moost boot captured the HTTP middleware (boot generation ${bootingGeneration}, latest ${bootGeneration}) — an HMR reload race; a follow-up reload will replace it.`,
              )
            }
            httpCaptured = true
            moostHttpRef.current = this as unknown as TSSRHttpContextRunner
            if (options.middleware) {
              moostMiddleware = this.getServerCb((req: IncomingMessage) => {
                pendingNextMap.get(req)?.()
              })
            } else {
              moostMiddleware = this.getServerCb()
            }
            if (options.ssrFetch !== false && moduleExports?.enableLocalFetch) {
              if (localFetchTeardown) {
                localFetchTeardown()
              }
              localFetchTeardown = moduleExports.enableLocalFetch(this)
              logger.log(`🔀 ${__DYE_DIM__}Local fetch enabled for SSR`)
            }
            setTimeout(() => {
              args.filter((a) => typeof a === 'function').forEach((a) => a())
            }, 1)
            return Promise.resolve()
          }
        }),
        createAdapterDetector('cli'),
        createAdapterDetector('wf'),
      ]
  /** A logger instance for plugin debug output. */
  const logger = isTest ? console : getLogger()
  let reloadRequired = false
  /** In-flight app reload, shared so concurrent requests await one reload. */
  let reloadPromise: Promise<void> | null = null
  /**
   * Drains any pending Moost app reload before a request is served. Assigned once
   * the SSR module runner exists (see configureServer); a no-op until then.
   */
  let drainReload: () => Promise<void> = () => Promise.resolve()
  /**
   * Last Moost entry import failure. While set, the dev middleware answers matching
   * requests with 502 instead of letting them fall through to the SPA/SSR fallback
   * (which would serve index.html for API routes). Cleared on a successful reload;
   * the next hot update schedules the retry.
   */
  let bootError: unknown = null
  /**
   * Looks up the Moost entry node with the verbatim `options.entry` string — the
   * module graph keys (and memoizes) unresolved urls as-is, so the same spelling
   * that was passed to `runner.import()` is guaranteed to return the very node
   * that import created.
   */
  const getEntryModule = (moduleGraph: EnvironmentModuleGraph) =>
    moduleGraph.getModuleByUrl(options.entry)
  /**
   * Drops the captured Moost app so the next request triggers a full reload:
   * releases the middleware + local fetch and queues the changed module IDs for
   * DI cleanup. The cleanup itself (infact ejects, wooks reset) is deferred to
   * runReload, under the reload lock: running it here, per hot-update wave,
   * raced in-flight requests and mid-boot imports mutating the same global
   * containers — ejected-but-still-referenced instances were lazily re-created
   * into the OLD pipeline, producing a mongrel half-old/half-new app. Waves
   * arriving before the lazy reload (editor bulk-save storms) coalesce into one
   * pending set and one cleanup.
   */
  const ejectApp = (cleanupInstances: Set<string>) => {
    bootGeneration++
    moostMiddleware = null
    moostHttpRef.current = null
    if (localFetchTeardown) {
      localFetchTeardown()
      localFetchTeardown = null
    }
    if (pendingCleanup) {
      for (const id of cleanupInstances) {
        pendingCleanup.add(id)
      }
    } else {
      pendingCleanup = cleanupInstances
    }
    reloadRequired = true
  }

  patchMoostHandlerLogging()
  if (!isTest && !isProd) {
    // Why a boot must await init() and not just the entry: see `captureMoostInit`.
    // Skipped wherever there is no dev server to consume the capture (prod/test),
    // so a rejection is never marked handled with nobody to report it.
    captureMoostInit((promise) => {
      if (bootingGeneration !== bootGeneration) {
        // Same race the listen() capture guards against: a torn boot finishing its
        // init after a newer eject. Ignore it; the follow-up reload replaces it.
        logger.error(
          `⚠️  A stale Moost boot called init() (boot generation ${bootingGeneration}, latest ${bootGeneration}) — an HMR reload race; a follow-up reload will replace it.`,
        )
        return
      }
      bootInitPromises.push(promise)
    })
  }
  /** Marks the boot about to run as authoritative for the current generation. */
  const beginBoot = () => {
    bootingGeneration = bootGeneration
    bootInitPromises = []
  }
  /**
   * Finishes a boot: awaits the `init()` promise(s) the entry that just executed
   * handed us, so the boot is only "done" once the app is fully initialized —
   * every controller bound, every `@MoostInit` hook run (see `captureMoostInit`).
   * Owns `bootError`: cleared on success, set and logged when an init rejected;
   * returns whether the boot succeeded.
   */
  const settleBootInit = async (): Promise<boolean> => {
    const initPromises = bootInitPromises
    bootInitPromises = []
    try {
      await Promise.all(initPromises)
      bootError = null
      return true
    } catch (error) {
      bootError = error
      logger.error(`✖️  Moost app init failed: ${(error as Error).message}`)
      return false
    }
  }
  /** Answers a request while `bootError` is set (see the gate in configureServer). */
  const answerBootError = (res: ServerResponse) => {
    res.statusCode = 502
    res.setHeader('Content-Type', 'text/plain')
    res.end(`Moost app failed to load: ${(bootError as Error).message}`)
  }

  /** Set by the middleware-mode `config` hook: the consumer externalized the runtime themselves. */
  let runtimeExternalized = false
  let resolvedConfig: ResolvedConfig | undefined

  const pluginConfig: PluginOption = {
    name: PLUGIN_NAME,
    enforce: 'pre',
    config(cfg, env) {
      // Middleware mode: configure multi-environment build
      if (options.middleware) {
        // Bake the Moost backend entry as a real Rollup input so it emits a built
        // file in dist/server (symmetric with how ssrEntry is handled below).
        // Previously __MOOST_ENTRY__ kept the raw dev path (e.g. '/src/main.ts'),
        // which the generated prod server then tried to `import()` at runtime — a
        // leading slash is a filesystem-absolute ESM specifier (file:///src/main.ts),
        // so it crashed with ERR_MODULE_NOT_FOUND. Building it yields
        // `dist/server/<name>.js` and __MOOST_ENTRY__ becomes a relative path
        // resolved next to server.js.
        const entryKeyBase = entryBasename(options.entry).replace(/\.js$/, '') // e.g. 'main'
        // 'server' is the reserved input key for the server entry below.
        const entryKey = entryKeyBase === 'server' ? 'moost-entry' : entryKeyBase

        const serverDefines: Record<string, string> = {
          'process.env.MOOST_DEFERRED_ENV': '"production"',
          __MOOST_ENTRY__: JSON.stringify(`./${entryKey}.js`),
          // `null` (not '/api') when omitted — the prod server must keep the
          // dev contract: no prefix → everything routes through Moost first.
          __MOOST_PREFIX__: JSON.stringify(prefixes ?? null),
          // Baked unconditionally (unlike the ssrEntry-gated defines below):
          // the prod server evaluates it at startup even when SSR is off.
          __MOOST_SSR_FORWARDING__: JSON.stringify(ssrForwarding),
        }

        // Build inputs: server entry + Moost backend entry are always included,
        // SSR entry added when configured.
        const serverEntry = options.serverEntry || generatedServerEntry(cfg.root)
        const ssrInput: Record<string, string> = {
          server: serverEntry,
          [entryKey]: options.entry,
        }

        if (options.ssrEntry) {
          const ssrBasename = entryBasename(options.ssrEntry)
          ssrInput[`ssr/${ssrBasename.replace(/\.js$/, '')}`] = options.ssrEntry
          serverDefines.__MOOST_SSR_ENTRY__ = JSON.stringify(`./ssr/${ssrBasename}`)
          serverDefines.__MOOST_SSR_OUTLET__ = JSON.stringify(
            options.ssrOutlet || DEFAULT_SSR_OUTLET,
          )
          serverDefines.__MOOST_SSR_STATE__ = JSON.stringify(options.ssrState || DEFAULT_SSR_STATE)
          serverDefines.__MOOST_SSR_HEAD__ = JSON.stringify(options.ssrHead || DEFAULT_SSR_HEAD)
        }

        // Nitro pattern: clean once upfront, emptyOutDir: false on all environments
        const outDir = cfg.build?.outDir || 'dist'

        // Default: bundle every dep into the SSR build (`noExternal: true`) to
        // avoid duplicate-module instances (Symbol-identity slot keys mismatch)
        // and pnpm transitive-dep leaks. Dev defaults to a selective allowlist
        // because bundling CJS-only deps would break Vite's ESM-only SSR module
        // runner. If the consumer sets their own `ssr.noExternal`, honor it
        // literally — but always include `@moostjs/vite` so the `define:`
        // substitutions in `prod-server.mjs` still land.
        const isBuild = env.command === 'build'
        const ourPlugin = /^@moostjs\/vite($|\/)/
        const userNoExternal = cfg.ssr?.noExternal
        let ssrNoExternal: true | (string | RegExp)[] =
          userNoExternal === true
            ? true
            : userNoExternal !== undefined
              ? [...(Array.isArray(userNoExternal) ? userNoExternal : [userNoExternal]), ourPlugin]
              : isBuild
                ? true
                : [ourPlugin]

        // In build, concat the consumer's explicit `ssr.external` (string list)
        // with the plugin's `ssrExternal` option (for native bindings etc.).
        // If the consumer set `ssr.external: true` we leave the concat empty —
        // `noExternal: true` is the policy and `true` on both sides is incoherent.
        const userExternal = cfg.ssr?.external
        const ssrExternal: string[] | undefined = isBuild
          ? [...(Array.isArray(userExternal) ? userExternal : []), ...(options.ssrExternal ?? [])]
          : undefined

        // Single-instance guard for the moost/wooks runtime.
        //
        // moost + wooks rely on per-module Symbol slot keys (cached()/key()). If
        // the same logical package is reachable on two paths — bundled in one place,
        // externalized in another — each path mints its own Symbols and event-context
        // lookups (useRequest/useHeaders/useAuthorization) read `undefined` at runtime
        // (prod only; dev dedupes via the SSR module runner).
        //
        // The bundle-everything default (`noExternal: true`, i.e. true / undefined-in-
        // build above) already yields one instance. The split only appears once the
        // consumer opts into an explicit `noExternal` list (e.g. to bundle `.as`-
        // shipping packages like `@aooth/*` for unplugin-atscript): everything not
        // listed is externalized, so external `moost` uses one `@wooksjs` copy while a
        // bundled listed package pulls in a second. Force the runtime to be bundled
        // alongside the listed packages so there is a single instance — unless the
        // consumer has explicitly externalized the runtime themselves (e.g.
        // `ssr.external: ['@wooksjs/event-http', ...]`), in which case their coherent
        // all-external setup is left intact.
        runtimeExternalized = (ssrExternal ?? []).some(
          (e) => typeof e === 'string' && RUNTIME_PACKAGE_PATTERNS.some((re) => re.test(e)),
        )
        if (isBuild && Array.isArray(ssrNoExternal) && !runtimeExternalized) {
          ssrNoExternal = [...ssrNoExternal, ...RUNTIME_PACKAGE_PATTERNS]
        }

        return {
          // SSR needs 'custom' to disable Vite's default HTML serving; SPA keeps default
          ...(options.ssrEntry && { appType: 'custom' as const }),
          ssr: {
            noExternal: ssrNoExternal,
            ...(ssrExternal && ssrExternal.length > 0 ? { external: ssrExternal } : {}),
          },
          builder: {
            async buildApp(builder: any) {
              rmSync(resolve(cfg.root || process.cwd(), outDir), { recursive: true, force: true })
              for (const env of Object.values(builder.environments) as any[]) {
                await builder.build(env)
              }
            },
          },
          environments: {
            client: {
              build: {
                outDir: `${outDir}/client`,
                emptyOutDir: false,
                ...(options.ssrEntry && { ssrManifest: true }),
              },
            },
            ssr: {
              build: {
                outDir: `${outDir}/server`,
                emptyOutDir: false,
                minify: false,
                sourcemap: !!(options.sourcemap ?? true),
                rollupOptions: {
                  input: ssrInput,
                  output: { format: 'esm' },
                },
              },
              define: serverDefines,
            },
          },
        }
      }

      // Moost-first mode: configure for backend SSR build.
      const entry = cfg.build?.rollupOptions?.input || options.entry
      const outfile = typeof entry === 'string' ? entryBasename(entry) : undefined

      return {
        server: {
          port: cfg.server?.port || options.port || 3000,
          host: cfg.server?.host || options.host,
        },
        optimizeDeps: {
          noDiscovery:
            cfg.optimizeDeps?.noDiscovery === undefined ? true : cfg.optimizeDeps.noDiscovery,
        },
        build: {
          target: cfg.build?.target || 'node',
          outDir: cfg.build?.outDir || options.outDir || 'dist',
          ssr: cfg.build?.ssr ?? true,
          minify: cfg.build?.minify || false,
          sourcemap: !!(options.sourcemap ?? true),
          rollupOptions: {
            external: isTest
              ? cfg.build?.rollupOptions?.external
              : cfg.build?.rollupOptions?.external ||
                (externals === false
                  ? []
                  : getExternals({
                      node: Boolean(externals === true || externals?.node),
                      workspace: Boolean(externals === true || externals?.workspace),
                    })),
            input: entry,
            output: {
              format: options.format,
              entryFileNames: outfile,
              ...cfg.build?.rollupOptions?.output,
            },
          },
        },
      }
    },

    /**
     * Expose plugin options on the resolved config for the SSR server helper.
     * In dev mode, createSSRServer() reads these after createViteServer() returns.
     */
    configResolved(config) {
      ;(config as Record<string, unknown>).__moostViteOptions = {
        entry: options.entry,
        ssrEntry: options.ssrEntry,
        serverEntry: options.serverEntry,
        prefix: prefixes,
        port: options.port,
        ssrOutlet: options.ssrOutlet,
        ssrState: options.ssrState,
        ssrHead: options.ssrHead,
        ssrFetchForwarding: options.ssrFetchForwarding,
      }
      ;(config as Record<string, unknown>).__moostViteHttpRef = moostHttpRef
      resolvedConfig = config
    },

    /**
     * Post-build check for split shared-state packages in the SSR output (see
     * `ssrExternalCheck`). The guard above keeps the runtime a single instance
     * but cannot see the mirror case: an externalized dependency that itself
     * depends on a bundled package loads a second copy from node_modules at
     * runtime. The emitted chunks carry both sides of that comparison — module
     * ids for what was bundled, bare specifiers for what stayed external — so
     * read those instead of re-deriving Vite's externalization.
     */
    generateBundle(_outputOptions, bundle) {
      const cfg = resolvedConfig
      if (
        !cfg ||
        cfg.command !== 'build' ||
        !options.middleware ||
        options.ssrExternalCheck === false ||
        this.environment?.name !== 'ssr'
      ) {
        return
      }
      const { externalIds, bundledPackages } = scanSsrBundle(bundle)
      const splits = findSplitPackages({
        root: cfg.root,
        externalIds,
        bundledPackages,
        patterns: compilePackagePatterns(
          typeof options.ssrExternalCheck === 'object'
            ? options.ssrExternalCheck.packages
            : undefined,
        ),
      })
      if (splits.length > 0) {
        cfg.logger.warn(`\n[${PLUGIN_NAME}] ${formatSplitPackagesWarning(splits)}\n`)
      }
    },

    /**
     * Transforms TypeScript source to:
     * - Detect `@moostjs/event-http` usage and patch `.listen()`.
     * - Inject `__VITE_ID(import.meta.filename)` for classes.
     */
    async transform(code, id) {
      if (!id.endsWith('.ts')) {
        return null
      }

      for (const adapter of adapters) {
        if (!adapter.detected && adapter.regex.test(code)) {
          await adapter.init()
        }
      }

      // Inject a decorator to track the file ID if the file exports a class
      if (REG_HAS_EXPORT_CLASS.test(code)) {
        const s = new MagicString(code)
        s.replace(REG_REPLACE_EXPORT_CLASS, '\n@__VITE_ID(import.meta.filename)\n$1')
        s.prepend(`import { __VITE_ID } from 'virtual:vite-id'\n\n`)
        return {
          code: s.toString(),
          map: s.generateMap({ hires: true }),
        }
      }
      return null
    },

    /**
     * Resolves our "virtual:vite-id" module.
     */
    resolveId(id) {
      if (id === 'virtual:vite-id') {
        return '\0virtual:vite-id'
      }
    },

    /**
     * Provides the code for "virtual:vite-id".
     * It exports a `__VITE_ID(id)` function that decorates a class with a `__vite_id` property.
     */
    load(id) {
      if (id === '\0virtual:vite-id') {
        return {
          code: `
          import { getMoostMate } from "moost";
          const mate = getMoostMate();
          export function __VITE_ID(id) {
            return mate.decorate("__vite_id", id)
          }
        `,
          map: null,
        }
      }
    },

    /**
     * Configure the dev server:
     * - Cleans up any existing Moost state.
     * - Loads the SSR entry (causing the app to initialize).
     * - Hooks into the server middlewares to use our Moost callback.
     */
    async configureServer(server) {
      // Pull-based runner: with HMR enabled, Vite's default ssr hot-update path
      // (taken by files outside the Moost entry graph) ends in a `full-reload`
      // payload that would make the runner clear its cache and re-import the entry
      // outside the drainReload lock — with a fresh, unpatched MoostHttp.prototype,
      // so app.listen() would bind a real port. All reloads go through runReload.
      const runner = createServerModuleRunner(server.environments.ssr, { hmr: false })
      const ssrImport = (id: string) => runner.import(id)
      // Reset closure state from a previous server: a stale bootError / pending
      // reload would 502 or double-boot the fresh server below. Inline plugin
      // instances are reused across server.restart(); with a config file the
      // factory re-runs instead (Vite re-imports the config) and a NEW instance
      // takes over — safe because the process-wide init patch has a single slot
      // that the newest instance fills (see `captureMoostInit`).
      bootError = null
      reloadRequired = false
      reloadPromise = null
      pendingCleanup = null
      beginBoot()

      // Serialize app reloads. On HMR, hotUpdate() nulls moostMiddleware and sets
      // reloadRequired; the next request lazily re-imports the entry. Without a lock,
      // a request arriving while the re-import is in flight would slip past into a
      // half-initialized app (null middleware / "controller.instance" not yet set)
      // and 500. The while-loop also covers a new hot update firing mid-reload: the
      // request keeps draining until no reload is pending.
      const runReload = () => {
        reloadRequired = false
        console.log()
        logger.debug('🚀 Reloading Moost App...')
        console.log()
        return (async () => {
          try {
            // This boot serves the latest eject generation; a listen() capture
            // arriving for an older generation is a torn boot (see the stamps).
            beginBoot()
            // Consume the pending eject cleanup under the reload lock (see ejectApp).
            const cleanupInstances = pendingCleanup ?? undefined
            pendingCleanup = null
            // Awaited: the ejected instances' `@MoostDispose` hooks must finish
            // releasing what they own (connections, consumers, handles) BEFORE
            // the adapters re-init and the entry re-imports — otherwise the
            // replacement instance opens a second copy of the same resource.
            await moostRestartCleanup(options.onEject, cleanupInstances)
            // Re-establish the adapter capture before re-importing the entry. The
            // listen() patch lives on whatever MoostHttp.prototype the runner first
            // evaluated; a reload may hand the re-imported entry a fresh
            // @moostjs/event-http evaluation whose prototype was never patched, so
            // app.listen() would bind the port for real → EADDRINUSE. Re-running
            // init() re-resolves the adapter through the same deduping runner the
            // entry imports from, re-applying the patch to the live prototype.
            for (const adapter of adapters) {
              if (adapter.detected) {
                await adapter.init()
              }
            }
            // hotUpdate() invalidates the entry node, so this import re-executes the
            // entry (re-running listen() → re-capturing the middleware). Backstop for
            // any path that left the entry node fresh: a cached import would be a
            // silent no-op and strand the middleware at null, so invalidate first.
            const entryModule = await getEntryModule(server.environments.ssr.moduleGraph)
            if (entryModule?.transformResult) {
              server.environments.ssr.moduleGraph.invalidateModule(entryModule)
            }
            await ssrImport(options.entry)
            // The entry is only evaluated at this point; `init()` is typically
            // still in flight (the documented order leaves it un-awaited). The
            // reload is not finished — and drainReload must not release the
            // waiting requests — until it settles.
            if ((await settleBootInit()) && httpCaptured && !moostMiddleware) {
              // The entry re-executed but listen() never re-captured a
              // middleware — requests would silently fall through to the
              // frontend handler. Surface it instead of serving wrong answers.
              logger.error(
                `⚠️  Moost app reloaded but no HTTP middleware was captured — the entry did not re-run listen().`,
              )
            }
          } catch (error) {
            // Swallow instead of letting the rejection escape into connect (which
            // would hang the request): the middleware serves 502 while bootError is
            // set, and the next hot update schedules the retry.
            bootError = error
            logger.error(`✖️  Failed to reload Moost App: ${(error as Error).message}`)
          }
          await new Promise((resolve) => setTimeout(resolve, 1))
        })().finally(() => {
          reloadPromise = null
        })
      }
      drainReload = async () => {
        while (reloadRequired || reloadPromise) {
          if (!reloadPromise) {
            reloadPromise = runReload()
          }
          await reloadPromise
        }
      }

      // Wire up SSR module loading so adapter detection patches
      // the same module instances that the SSR app will use.
      for (const adapter of adapters) {
        adapter.ssrLoadModule = ssrImport
      }

      await moostRestartCleanup(options.onEject)

      // Import the SSR entry so the app initializes
      // (MoostHttp.listen is patched, so no actual server is spawned).
      await ssrImport(options.entry)
      // …and for the app to be initialized, not merely evaluated, BEFORE the
      // middleware is attached below — so the initial boot cannot serve a
      // half-bound app either (reloads are covered by drainReload). A failing init
      // sets bootError instead of taking the dev server down; the next hot update
      // retries. See `captureMoostInit`.
      await settleBootInit()

      // Attach Moost as a middleware if present
      server.middlewares.use(async (req, res, next) => {
        await drainReload()

        // In middleware mode with prefix: skip Moost for non-matching paths (fast path)
        if (options.middleware && prefixes && !matchesPrefix(req.url || '', prefixes)) {
          return next()
        }

        if (bootError) {
          // Checked BEFORE the captured middleware (see `captureMoostInit`), and
          // answered explicitly rather than falling through to the SPA/SSR
          // fallback, which would serve index.html for API routes.
          answerBootError(res)
          return
        }
        if (moostMiddleware) {
          if (options.middleware) {
            pendingNextMap.set(req, next)
            moostMiddleware(req, res)
            return
          }
          return moostMiddleware(req, res)
        }
        next()
      })
    },

    /**
     * Scoped Moost hot reload. The hook runs once per environment:
     * - Client (and custom) environments are never touched, so Vite's default HMR
     *   keeps delivering browser updates for client-side ts/js/vue modules.
     * - In the ssr environment, only changes whose importer chain reaches the Moost
     *   entry trigger an app reload: collect importers for DI cleanup, invalidate
     *   them (entry included, so the re-import re-executes), eject affected DI
     *   instances and schedule the reload.
     * - ssr modules outside the entry graph (e.g. the ssrEntry render graph) take
     *   Vite's default invalidation, so the next SSR render picks them up without
     *   rebooting Moost.
     */
    async hotUpdate({ file, modules }) {
      if (this.environment.name !== 'ssr' || modules.length === 0) {
        return
      }
      const { moduleGraph } = this.environment
      const entryModule = await getEntryModule(moduleGraph)
      const importerSets = modules.map((mod) => gatherAllImporters(mod))
      // gatherAllImporters includes the start node, so editing the entry itself matches too
      if (entryModule && !importerSets.some((importers) => importers.has(entryModule))) {
        return
      }
      logger.debug(`🔃 Hot update: ${file}`)
      const cleanupInstances = new Set<string>()
      for (const importers of importerSets) {
        for (const impModule of importers) {
          if (impModule.id) {
            cleanupInstances.add(impModule.id)
          }
        }
      }
      for (const mod of modules) {
        moduleGraph.invalidateModule(mod)
      }
      if (entryModule) {
        // Guarantee the next runReload() re-executes the entry even if importer
        // propagation stopped short of it for any reason.
        moduleGraph.invalidateModule(entryModule)
      } else {
        // Entry node not resolvable (it was never imported) — fail open with a
        // full invalidation so the scheduled reload re-executes everything.
        moduleGraph.invalidateAll()
      }
      ejectApp(cleanupInstances)
      // Handled: suppress Vite's default ssr hot update for these modules
      return []
    },
  }

  if (isProd || isTest) {
    delete pluginConfig.configureServer
    delete pluginConfig.resolveId
    delete pluginConfig.load
    delete pluginConfig.transform
    delete pluginConfig.hotUpdate
  }

  // SSR fallback plugin: runs after Vite's internal middleware
  const ssrFallbackPlugin: PluginOption =
    !isProd && !isTest && options.middleware && options.ssrEntry
      ? {
          name: `${PLUGIN_NAME}:ssr-fallback`,
          async configureServer(server) {
            const ssrOutlet = options.ssrOutlet || DEFAULT_SSR_OUTLET
            const ssrState = options.ssrState || DEFAULT_SSR_STATE
            const ssrHead = options.ssrHead || DEFAULT_SSR_HEAD
            const fs = await import('node:fs/promises')
            // Return post-hook so this runs AFTER Vite's internal middleware
            return () => {
              server.middlewares.use(async (req: any, res: ServerResponse, next: () => void) => {
                if (req.method !== 'GET') {
                  return next()
                }
                const url = req.originalUrl || req.url || '/'
                try {
                  // Same reload lock as the main middleware: an HMR mid-render would
                  // otherwise race ssrLoadModule against a half-ejected app.
                  await drainReload()
                  if (bootError) {
                    // Same gate as the main middleware: the local-fetch hook listen()
                    // installed would dispatch SSR self-fetches into the half-bound app.
                    answerBootError(res)
                    return
                  }
                  let template = await fs.readFile(
                    resolve(server.config.root, 'index.html'),
                    'utf8',
                  )
                  template = await server.transformIndexHtml(url, template)
                  const { render } = await server.ssrLoadModule(options.ssrEntry!)
                  const result = await renderSSRPage({
                    render: render as TSSRRender,
                    url,
                    req,
                    res,
                    http: ssrForwarding ? moostHttpRef.current : null,
                  })
                  sendSSRResponse(res, template, { ssrOutlet, ssrState, ssrHead }, result)
                } catch (error: any) {
                  server.ssrFixStacktrace(error)
                  console.error(error)
                  res.statusCode = 500
                  res.end(error.message)
                }
              })
            }
          },
        }
      : null

  return [pluginConfig, ssrFallbackPlugin]
}
