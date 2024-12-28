/* eslint-disable max-depth */
/* eslint-disable func-names */
import type { IncomingMessage, ServerResponse } from 'http'
import type { Plugin } from 'vite'

import { createAdapterDetector } from './adapter-detector'
import { moostRestartCleanup } from './restart-cleanup'
import { gatherAllImporters, getLogger, PLUGIN_NAME } from './utils'

/** A simple request-response middleware type for Node’s http module. */
type TMiddleware = (req: IncomingMessage, res: ServerResponse) => any

/** Regex checks */
const REG_HAS_EXPORT_CLASS = /(^\s*export\s+class\s+)/m
const REG_REPLACE_EXPORT_CLASS = /(^\s*export\s+class\s+)/gm

export interface TMoostViteDevOptions {
  entry: string
  port?: number
  host?: string
  outDir?: string
  format?: 'cjs' | 'esm'
  sourcemap?: boolean
}

/**
 * The main Vite plugin that:
 * - Detects when moost adapter usage (http, cli, wf).
 * - Patches `MoostHttp.prototype.listen` in dev mode to register a custom middleware instead of listening on a port.
 * - Injects a `__VITE_ID()` decorator into exported classes to track them for hot reload cleanup.
 * - Cleans up internal Moost state upon hot updates, then reloads the SSR entry.
 */
export function moostViteDev(options: TMoostViteDevOptions): Plugin {
  const entry = options.entry
  let moostMiddleware: TMiddleware | null = null
  const adapters = [
    createAdapterDetector('http', MoostHttp => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      MoostHttp.prototype.listen = function (...args: any[]) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
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
  const logger = getLogger()

  return {
    name: PLUGIN_NAME,
    apply: 'serve',
    enforce: 'pre',

    config(cfg) {
      return {
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
          target: cfg.build?.target || 'node20',
          outDir: cfg.build?.outDir || options.outDir || 'dist',
          ssr: cfg.build?.ssr || options.entry,
          minify: cfg.build?.minify || false,
          rollupOptions: {
            input: cfg.build?.rollupOptions?.input || options.entry,
            output: cfg.build?.rollupOptions?.output || {
              format: options.format,
              sourcemap: !!(options.sourcemap ?? true),
            },
          },
        },
      }
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
        code = code.replace(
          REG_REPLACE_EXPORT_CLASS,
          '@__VITE_ID(import.meta.filename)\nexport class '
        )
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
      moostRestartCleanup(adapters)

      // Import the SSR entry so the app initializes
      // (MoostHttp.listen is patched, so no actual server is spawned).
      await server.ssrLoadModule(entry)

      // Attach Moost as a middleware if present
      server.middlewares.use((req, res, next) => {
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
    async hotUpdate({ file, server }) {
      if (file.endsWith('.ts')) {
        const modules = this.environment.moduleGraph.getModulesByFile(file)
        if (modules) {
          console.clear()
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
          moostRestartCleanup(adapters, cleanupInstances)

          logger.debug('🚀 Reloading Moost App...')
          await server.ssrLoadModule(entry)
        }
        // Return an empty array so Vite doesn't do partial HMR
        return []
      }
    },
  }
}
