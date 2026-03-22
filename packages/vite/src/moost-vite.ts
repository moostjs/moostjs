import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { resolve } from 'node:path'
import type { PluginOption } from 'vite'
import { createServerModuleRunner } from 'vite'
import MagicString from 'magic-string'

import { createAdapterDetector } from './adapter-detector'
import { patchMoostHandlerLogging } from './moost-logging'
import { moostRestartCleanup } from './restart-cleanup'
import {
  DEFAULT_SSR_OUTLET,
  DEFAULT_SSR_STATE,
  entryBasename,
  gatherAllImporters,
  getExternals,
  getLogger,
  PLUGIN_NAME,
} from './utils'

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
   * Run Moost as Connect middleware instead of taking over the server.
   * When enabled, Moost handles only matching routes (guarded by `prefix`),
   * and unmatched requests fall through to Vite's default handler
   * (static assets, Vue/React pages, HMR client).
   *
   * Use this for fullstack apps where Vite serves the frontend (Vue, React, etc.)
   * and Moost handles API routes.
   *
   * Default: `false`.
   */
  middleware?: boolean
  /**
   * URL prefix for Moost API routes in middleware mode.
   * Only requests starting with this prefix are dispatched to Moost.
   * Ignored when `middleware` is `false`.
   *
   * Example: `'/api'`
   */
  prefix?: string
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
   * Path to a custom server entry file (e.g., `'./server.ts'`).
   * When provided, this file is used as the production server build entry.
   * When omitted in middleware mode, the plugin auto-generates a minimal
   * production server that serves static files + Moost API (+ SSR if configured).
   */
  serverEntry?: string
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

export function moostVite(options: TMoostViteDevOptions): PluginOption {
  const isTest = process.env.NODE_ENV === 'test'
  const isProd = process.env.NODE_ENV === 'production'
  const externals = options.externals ?? true

  // Normalize prefix: ensure leading slash, strip trailing slash
  let prefix = options.prefix
  if (prefix) {
    if (!prefix.startsWith('/')) prefix = `/${prefix}`
    if (prefix.endsWith('/')) prefix = prefix.slice(0, -1)
  }

  const prefixSlash = prefix ? prefix + '/' : undefined
  const prefixQuery = prefix ? prefix + '?' : undefined

  let moostMiddleware: TMiddleware | null = null
  let localFetchTeardown: (() => void) | null = null
  /** In middleware mode: maps req → next() for the onNoMatch callback */
  const pendingNextMap = new WeakMap<IncomingMessage, () => void>()

  const adapters = isTest
    ? []
    : [
        createAdapterDetector('http', (MoostHttp, moduleExports) => {
          MoostHttp.prototype.listen = function (...args: any[]) {
            logger.log(`🔌 ${__DYE_DIM__}Overtaking HTTP.listen`)
            if (options.middleware) {
              moostMiddleware = this.getServerCb((req: IncomingMessage) => {
                pendingNextMap.get(req)?.()
              })
            } else {
              moostMiddleware = this.getServerCb()
            }
            if (options.ssrFetch !== false && moduleExports?.enableLocalFetch) {
              if (localFetchTeardown) localFetchTeardown()
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

  patchMoostHandlerLogging()

  const pluginConfig: PluginOption = {
    name: PLUGIN_NAME,
    enforce: 'pre',
    config(cfg) {
      // Middleware mode: configure multi-environment build
      if (options.middleware) {
        const defaultExternals = getExternals({ node: true, workspace: true })
        const serverDefines: Record<string, string> = {
          'process.env.MOOST_DEFERRED_ENV': '"production"',
          __MOOST_ENTRY__: JSON.stringify(options.entry),
          __MOOST_PREFIX__: JSON.stringify(prefix || '/api'),
        }

        // Build inputs: server entry is always included, SSR entry added when configured
        const serverEntry = options.serverEntry || generatedServerEntry(cfg.root)
        const ssrInput: Record<string, string> = {
          server: serverEntry,
        }

        if (options.ssrEntry) {
          const ssrBasename = entryBasename(options.ssrEntry)
          ssrInput[`ssr/${ssrBasename.replace(/\.js$/, '')}`] = options.ssrEntry
          serverDefines.__MOOST_SSR_ENTRY__ = JSON.stringify(`./ssr/${ssrBasename}`)
          serverDefines.__MOOST_SSR_OUTLET__ = JSON.stringify(options.ssrOutlet || DEFAULT_SSR_OUTLET)
          serverDefines.__MOOST_SSR_STATE__ = JSON.stringify(options.ssrState || DEFAULT_SSR_STATE)
        }

        // Nitro pattern: clean once upfront, emptyOutDir: false on all environments
        const outDir = cfg.build?.outDir || 'dist'
        return {
          // SSR needs 'custom' to disable Vite's default HTML serving; SPA keeps default
          ...(options.ssrEntry && { appType: 'custom' as const }),
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
                  external: (id: string) => {
                    if (id === '@moostjs/vite/server') return false
                    return defaultExternals.some((ext) => ext.test(id))
                  },
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
      const outfile =
        typeof entry === 'string' ? entryBasename(entry) : undefined

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
        prefix,
        port: options.port,
        ssrOutlet: options.ssrOutlet,
        ssrState: options.ssrState,
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
      if (id === 'virtual:vite-id') return '\0virtual:vite-id'
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
      const runner = createServerModuleRunner(server.environments.ssr)
      const ssrImport = (id: string) => runner.import(id)

      // Wire up SSR module loading so adapter detection patches
      // the same module instances that the SSR app will use.
      for (const adapter of adapters) {
        adapter.ssrLoadModule = ssrImport
      }

      moostRestartCleanup(adapters, options.onEject)

      // Import the SSR entry so the app initializes
      // (MoostHttp.listen is patched, so no actual server is spawned).
      await ssrImport(options.entry)

      // Attach Moost as a middleware if present
      server.middlewares.use(async (req, res, next) => {
        if (reloadRequired) {
          reloadRequired = false
          console.log()
          logger.debug('🚀 Reloading Moost App...')
          console.log()
          await ssrImport(options.entry)
          await new Promise((resolve) => setTimeout(resolve, 1))
        }

        // In middleware mode with prefix: skip Moost for non-matching paths (fast path)
        if (options.middleware && prefix) {
          const url = req.url || ''
          if (url !== prefix && !url.startsWith(prefixSlash!) && !url.startsWith(prefixQuery!)) {
            return next()
          }
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
     * When a hot update occurs on a .ts file:
     * - Collect all importer modules recursively.
     * - Invalidate them so Vite re-loads.
     * - Clear Moost’s runtime registry for those classes.
     * - Re-import the SSR entry to re-initialize the app.
     */
    hotUpdate({ file }) {
      if (file.endsWith('.ts')) {
        const modules = this.environment.moduleGraph.getModulesByFile(file)
        if (modules) {
          logger.debug(`🔃 Hot update: ${file}`)
          const cleanupInstances = new Set<string>()
          for (const mod of modules) {
            const allImporters = gatherAllImporters(mod)
            for (const impModule of allImporters) {
              if (impModule.id) {
                cleanupInstances.add(impModule.id)
              }
            }
            this.environment.moduleGraph.invalidateModule(mod)
          }

          // Reset the Moost middleware and local fetch instances
          moostMiddleware = null
          if (localFetchTeardown) {
            localFetchTeardown()
            localFetchTeardown = null
          }

          // Clean up Moost container references
          moostRestartCleanup(adapters, options.onEject, cleanupInstances)

          reloadRequired = true
        }
        // Return an empty array so Vite doesn't do partial HMR
        return []
      }
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
            const fs = await import('node:fs/promises')
            // Return post-hook so this runs AFTER Vite's internal middleware
            return () => {
              server.middlewares.use(async (req: any, res: ServerResponse, next: () => void) => {
                if (req.method !== 'GET') return next()
                const url = req.originalUrl || req.url || '/'
                try {
                  let template = await fs.readFile(resolve(process.cwd(), 'index.html'), 'utf-8')
                  template = await server.transformIndexHtml(url, template)
                  const { render } = await server.ssrLoadModule(options.ssrEntry!)
                  const { html: appHtml, state } = await render(url)
                  res.statusCode = 200
                  res.setHeader('Content-Type', 'text/html')
                  res.end(
                    template
                      .replace(ssrOutlet, appHtml)
                      .replace(
                        ssrState,
                        state ? `<script>window.__SSR_STATE__=${state}</script>` : '',
                      ),
                  )
                } catch (e: any) {
                  server.ssrFixStacktrace(e)
                  console.error(e)
                  res.statusCode = 500
                  res.end(e.message)
                }
              })
            }
          },
        }
      : null

  return [pluginConfig, ssrFallbackPlugin]
}
