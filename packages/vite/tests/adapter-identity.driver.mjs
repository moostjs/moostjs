// Driver for adapter-identity.spec.ts — boots a dev server whose Moost app sits
// next to an EXTERNALIZED dependency (`ext-consumer`, loaded natively by Node)
// that imports `@moostjs/event-http` itself and resolves the adapter through DI
// (`useControllerContext().instantiate(MoostHttp)`) — the shape of
// `@atscript/moost-db`'s delegated query targets.
//
// Runs in a plain Node process against the BUILT plugin, for the same reason
// as hot-update.driver.mjs: the plugin must share the native `moost` /
// `@moostjs/event-http` instances with the fixture app.
//
// Usage: node adapter-identity.driver.mjs <scenario>
//   default — the runtime externalized, as in an npm-installed app
//   forced  — `ssr.noExternal: ['@moostjs/event-http']`: a config-forced split
// Emits one `__RESULT__ {json}` line on stdout and exits 0 on success.
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

process.env.NODE_ENV = 'development'

const scenario = process.argv[2] ?? 'default'
const FIXTURE_ROOT = fileURLToPath(new URL(`fixture-tmp-identity-${scenario}`, import.meta.url))

const FIXTURE_FILES = {
  'package.json': `{ "name": "identity-fixture", "private": true, "type": "module", "dependencies": { "ext-consumer": "*" } }
`,
  'tsconfig.json': `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  }
}
`,
  // A real directory under node_modules: Vite externalizes it, Node loads it
  // natively and resolves its own `@moostjs/event-http` / `moost` imports.
  'node_modules/ext-consumer/package.json': `{
  "name": "ext-consumer",
  "version": "1.0.0",
  "type": "module",
  "exports": { ".": "./index.mjs" },
  "peerDependencies": { "@moostjs/event-http": "*", "moost": "*" }
}
`,
  'node_modules/ext-consumer/index.mjs': `import { MoostHttp } from '@moostjs/event-http'
import { useControllerContext } from 'moost'

export const ExtMoostHttp = MoostHttp

/** What a natively loaded library does to reach the attached adapter. */
export function instantiateAdapter() {
  return useControllerContext().instantiate(MoostHttp)
}
`,
  'src/main.ts': `import { Moost } from 'moost'
import { MoostHttp } from '@moostjs/event-http'

import { ApiController } from './controller'

const app = new Moost()
app.adapter(new MoostHttp()).listen(3000)
app.registerControllers(ApiController)
void app.init()
`,
  'src/controller.ts': `import { Controller, useControllerContext } from 'moost'
import { Get, MoostHttp } from '@moostjs/event-http'
import { ExtMoostHttp, instantiateAdapter } from 'ext-consumer'

@Controller('api')
export class ApiController {
  @Get('identity')
  async identity() {
    const own = await useControllerContext().instantiate(MoostHttp)
    let viaExternal: string
    try {
      viaExternal = (await instantiateAdapter()) === own ? 'attached adapter' : 'another instance'
    } catch (error) {
      viaExternal = 'error: ' + (error as Error).message
    }
    return { sameClass: MoostHttp === ExtMoostHttp, viaExternal }
  }
}
`,
}

rmSync(FIXTURE_ROOT, { recursive: true, force: true })
for (const [rel, content] of Object.entries(FIXTURE_FILES)) {
  const abs = resolve(FIXTURE_ROOT, rel)
  mkdirSync(dirname(abs), { recursive: true })
  writeFileSync(abs, content)
}

const { createServer } = await import('vite')
const { moostVite } = await import('../dist/index.mjs')

/** Warnings Vite's logger received (the plugin's dev split check reports there). */
const warnings = []
const customLogger = {
  hasWarned: false,
  info() {},
  warn(msg) {
    warnings.push(String(msg))
  },
  warnOnce(msg) {
    warnings.push(String(msg))
  },
  error(msg) {
    warnings.push(`[error] ${String(msg)}`)
  },
  clearScreen() {},
  hasErrorLogged: () => false,
}

const SSR = {
  // Match a real (npm-installed) app: in this workspace the moost packages are
  // linked, which Vite would inline by default.
  default: { external: ['moost', '@moostjs/event-http'] },
  // The adapter is forced into the SSR module runner while `ext-consumer`
  // stays external: two copies of `@moostjs/event-http`, by configuration.
  forced: { external: ['moost'], noExternal: ['@moostjs/event-http'] },
}

let server
try {
  server = await createServer({
    root: FIXTURE_ROOT,
    configFile: false,
    customLogger,
    server: { host: 'localhost', port: 25123 + (process.pid % 500) },
    ssr: SSR[scenario],
    plugins: [moostVite({ entry: './src/main.ts', middleware: true, prefix: '/api' })],
  })
  await server.listen()
  const baseUrl = `http://localhost:${server.httpServer.address().port}`
  const res = await fetch(`${baseUrl}/api/identity`)
  const text = await res.text()
  let json = null
  try {
    json = JSON.parse(text)
  } catch {
    // not JSON — `text` carries the error
  }
  console.log(
    `__RESULT__ ${JSON.stringify({ status: res.status, text: text.slice(0, 300), json, warnings })}`,
  )
} finally {
  await server?.close()
  rmSync(FIXTURE_ROOT, { recursive: true, force: true })
}
