import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { moostVite } from '@moostjs/vite'

export default defineConfig({
  server: { port: 3000 },
  // No `ssr` block on purpose: `vite build` then defaults to `ssr.noExternal: true`,
  // bundling every dependency so the moost/wooks event context exists exactly once.
  //
  // Need something external (a native driver, or to shrink dist/server)? Prefer
  // `ssr.external` ALONE — it composes with the bundle-everything default:
  //
  //   ssr: { external: ['better-sqlite3', 'mysql2'] },
  //
  // Adding `ssr.noExternal` flips the policy: everything NOT listed becomes external.
  // Rule: a package with module state — moost/wooks (and any `@atscript/*` package) —
  // is either entirely bundled or entirely external, together with everything that
  // depends on it; a split breaks in production only. `vite build` warns when it
  // detects one — see https://moost.org/webapp/vite#ssr-bundle-size
  plugins: [
    vue(),
    moostVite({
      entry: '/src/main.ts',
      middleware: true,
      prefix: '/api',
//=IF (ssr)
      ssrEntry: '/src/entry-server.ts',
//=END IF
    }),
  ],
})
