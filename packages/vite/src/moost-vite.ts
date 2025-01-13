/* eslint-disable max-depth */
/* eslint-disable func-names */
import type { IncomingMessage, ServerResponse } from 'http'
import type { Plugin } from 'vite'
import { mergeConfig } from 'vite'

import { createAdapterDetector } from './adapter-detector'
import { patchMoostHandlerLogging } from './moost-logging'
import { moostRestartCleanup } from './restart-cleanup'
import { gatherAllImporters, getExternals, getLogger, PLUGIN_NAME } from './utils'

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
  // eslint-disable-next-line @typescript-eslint/ban-types
  onEject?: (instance: object, dependency: Function) => boolean
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
 * @returns {Plugin} The configured Vite plugin.
 */
export function moostVite(options: TMoostViteDevOptions): Plugin {
  const isTest = process.env.NODE_ENV === 'test'
  const isProd = process.env.NODE_ENV === 'production'

  let moostMiddleware: TMiddleware | null = null
  const adapters = isTest
    ? []
    : [
        createAdapterDetector('http', MoostHttp => {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          MoostHttp.prototype.listen = function (...args: any[]) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
            moostMiddleware = this.getServerCb()
            setTimeout(() => {
              // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
              args.filter(a => typeof a === 'function').forEach(a => a())
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

  const pluginConfig: Plugin = {
    name: PLUGIN_NAME,
    enforce: 'pre',
    config(cfg) {
      const entry = cfg.build?.rollupOptions?.input || options.entry
      const outfile =
        typeof entry === 'string' ? entry.split('/').pop()!.replace(/\.ts$/, '.js') : undefined

      const pluginConfig = {
        server: {
          port: cfg.server?.port || options.port || 3000,
          host: cfg.server?.host || options.host,
        },
        optimizeDeps: {
          noDiscovery:
            cfg.optimizeDeps?.noDiscovery === undefined ? true : cfg.optimizeDeps.noDiscovery,
          exclude: cfg.optimizeDeps?.exclude || ['@swc/core'],
        },
        build: {
          target: cfg.build?.target || 'node',
          outDir: cfg.build?.outDir || options.outDir || 'dist',
          ssr: cfg.build?.ssr ?? true,
          minify: cfg.build?.minify || false,
          rollupOptions: {
            external: isTest
              ? cfg.build?.rollupOptions?.external
              : cfg.build?.rollupOptions?.external ||
                (options.externals === false
                  ? []
                  : getExternals({
                      node: Boolean(options.externals === true || options.externals?.node),
                      workspace: Boolean(
                        options.externals === true || options.externals?.workspace
                      ),
                    })),
            input: entry,
            output: {
              format: options.format,
              sourcemap: !!(options.sourcemap ?? true),
              entryFileNames: outfile,
              ...cfg.build?.rollupOptions?.output,
            },
          },
        },
      }

      return mergeConfig(cfg, pluginConfig)
    },

    /**
     * Transforms TypeScript source to:
     * - Detect `@moostjs/event-http` usage and patch `.listen()`.
     * - Inject `__VITE_ID(import.meta.filename)` for classes.
     */
    async transform(code, id) {
      if (!id.endsWith('.ts')) {
        return code
      }

      for (const adapter of adapters) {
        if (!adapter.detected && adapter.regex.test(code)) {
          await adapter.init()
        }
      }

      // Inject a decorator to track the file ID if the file exports a class
      if (REG_HAS_EXPORT_CLASS.test(code)) {
        code = code.replace(REG_REPLACE_EXPORT_CLASS, '\n@__VITE_ID(import.meta.filename)\n$1')
        code = `import { __VITE_ID } from 'virtual:vite-id'\n\n${code}`
      }
      return code
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
        return `
          import { getMoostMate } from "moost";
          const mate = getMoostMate();
          export function __VITE_ID(id) {
            return mate.decorate("__vite_id", id)
          }
        `
      }
    },

    /**
     * Configure the dev server:
     * - Cleans up any existing Moost state.
     * - Loads the SSR entry (causing the app to initialize).
     * - Hooks into the server middlewares to use our Moost callback.
     */
    async configureServer(server) {
      moostRestartCleanup(adapters, options.onEject)

      // Import the SSR entry so the app initializes
      // (MoostHttp.listen is patched, so no actual server is spawned).
      await server.ssrLoadModule(options.entry)

      // Attach Moost as a middleware if present
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      server.middlewares.use(async (req, res, next) => {
        if (reloadRequired) {
          reloadRequired = false
          console.log()
          logger.debug('🚀 Reloading Moost App...')
          console.log()
          await server.ssrLoadModule(options.entry)
          // eslint-disable-next-line no-promise-executor-return
          await new Promise(resolve => setTimeout(resolve, 1))
        }
        if (moostMiddleware) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-return
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

          // Reset the Moost middleware instance
          moostMiddleware = null

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

  return pluginConfig
}
