// Driver for hot-update.spec.ts — runs the full hot-reload scenario in a plain
// Node process. The spec spawns this script instead of importing the plugin
// directly because the plugin must share the native `moost` /
// `@moostjs/event-http` module instances with its fixture app (the fixture dev
// server externalizes them); vitest's module runner would inline its own copies
// of the workspace-linked packages and DI cleanup would operate on the wrong
// singletons — something that cannot happen in a real (npm-installed) app.
//
// Imports the BUILT plugin: run `pnpm build vite` first.
// Emits one `__RESULT__ {json}` line on stdout and exits 0 on success.
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

process.env.NODE_ENV = 'development'

const FIXTURE_ROOT = fileURLToPath(new URL('fixture-tmp', import.meta.url))

/**
 * Fullstack fixture (middleware: true + prefix + ssrEntry) with three distinct
 * module graphs sharing one Vite dev server:
 * - Moost entry graph:   main.ts → controller.ts → value.ts + config.json
 * - SSR render graph:    entry-server.ts → note.ts (loaded via server.ssrLoadModule)
 * - client-only graph:   ui/notify.ts (loaded only by the browser)
 */
const FIXTURE_FILES = {
  'index.html': `<!doctype html>
<html>
  <head><title>fixture</title></head>
  <body>
    <div id="app"><!--ssr-outlet--></div>
    <!--ssr-state-->
    <script type="module" src="/src/ui/notify.ts"></script>
  </body>
</html>
`,
  'tsconfig.json': `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "experimentalDecorators": true
  }
}
`,
  'src/main.ts': `import { Moost } from 'moost'
import { MoostHttp } from '@moostjs/event-http'

import { ApiController } from './controller'

const g = globalThis as Record<string, unknown>
g.__fixture_boot = ((g.__fixture_boot as number) ?? 0) + 1

const app = new Moost()
const http = new MoostHttp()
app.adapter(http).listen(3000)
app.registerControllers(ApiController)
void app.init()
`,
  'src/controller.ts': `import { Controller } from 'moost'
import { Get } from '@moostjs/event-http'

import config from './config.json'
import { VALUE } from './value'

@Controller('api')
export class ApiController {
  @Get('health')
  health() {
    return {
      ok: true,
      boot: (globalThis as Record<string, unknown>).__fixture_boot as number,
      value: VALUE,
      tag: (config as { tag: string }).tag,
    }
  }
}
`,
  'src/value.ts': `export const VALUE = 'v1'
`,
  'src/config.json': `{ "tag": "a" }
`,
  'src/entry-server.ts': `import { NOTE } from './note'

export async function render(_url: string) {
  return { html: \`<main>\${NOTE}</main>\`, state: '' }
}
`,
  'src/note.ts': `export const NOTE = 'NOTE_v1'
`,
  'src/ui/notify.ts': `export const toast = 'toast_v1'
`,
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function pollUntil(fn, predicate, timeout = 15_000) {
  const deadline = Date.now() + timeout
  let last = await fn()
  while (!predicate(last) && Date.now() < deadline) {
    await sleep(150)
    last = await fn()
  }
  return last
}

function editFile(rel, content) {
  writeFileSync(resolve(FIXTURE_ROOT, rel), content)
}

rmSync(FIXTURE_ROOT, { recursive: true, force: true })
for (const [rel, content] of Object.entries(FIXTURE_FILES)) {
  const abs = resolve(FIXTURE_ROOT, rel)
  mkdirSync(dirname(abs), { recursive: true })
  writeFileSync(abs, content)
}

const { createServer } = await import('vite')
const { moostVite } = await import('../dist/index.mjs')

let server
try {
  server = await createServer({
    root: FIXTURE_ROOT,
    configFile: false,
    logLevel: 'error',
    server: { host: 'localhost', port: 24123 + (process.pid % 500) },
    // Match a real (npm-installed) app: the moost runtime is externalized in dev,
    // so the fixture app and the plugin share the same module instances.
    ssr: { external: ['moost', '@moostjs/event-http'] },
    plugins: [
      moostVite({
        entry: './src/main.ts',
        middleware: true,
        prefix: '/api',
        ssrEntry: '/src/entry-server.ts',
      }),
    ],
  })
  await server.listen()
  const baseUrl = `http://localhost:${server.httpServer.address().port}`

  const getHealth = async () => {
    const res = await fetch(`${baseUrl}/api/health`)
    const text = await res.text()
    let json = null
    try {
      json = JSON.parse(text)
    } catch {
      json = null
    }
    return { status: res.status, text: text.slice(0, 200), json }
  }
  const getPage = async () => await fetch(`${baseUrl}/`).then((res) => res.text())
  const getClientMod = async () =>
    await fetch(`${baseUrl}/src/ui/notify.ts`).then((res) => res.text())

  const report = {}

  // 1. baseline: API + SSR page + client module (registers it in the client graph)
  const baselinePage = await getPage()
  const baselineClientMod = await getClientMod()
  report.baseline = {
    health: await getHealth(),
    page: baselinePage.slice(0, 500),
    clientMod: baselineClientMod.slice(0, 200),
  }

  // 2. client-only edit must not kill the API nor reboot the app.
  // Poll the client module first: serving the fresh transform proves the watcher
  // processed the edit, so the health snapshots below are taken after the hot
  // update actually ran (a fixed sleep would race the watcher on slow machines).
  editFile('src/ui/notify.ts', `export const toast = 'toast_v2'\n`)
  const clientOnlyMod = await pollUntil(getClientMod, (text) => text.includes('toast_v2'))
  await sleep(300)
  const clientOnlyFirst = await getHealth()
  const clientOnlySecond = await getHealth()
  report.clientOnly = {
    first: clientOnlyFirst,
    second: clientOnlySecond,
    clientMod: clientOnlyMod.slice(0, 200),
  }

  // 3. SSR render-graph edit refreshes the page without rebooting the app
  editFile('src/note.ts', `export const NOTE = 'NOTE_v2'\n`)
  const renderPage = await pollUntil(getPage, (text) => text.includes('NOTE_v2'))
  report.renderGraph = {
    page: renderPage.slice(0, 500),
    health: await getHealth(),
  }

  // 4. server-graph edit reloads the app
  editFile('src/value.ts', `export const VALUE = 'v2'\n`)
  report.serverGraph = {
    health: await pollUntil(getHealth, (h) => h.json?.value === 'v2'),
  }

  // 5. non-ts entry-graph file (json) reloads the app
  editFile('src/config.json', `{ "tag": "b" }\n`)
  report.jsonFile = {
    health: await pollUntil(getHealth, (h) => h.json?.tag === 'b'),
  }

  // 6. entry edit reloads the app
  editFile('src/main.ts', `${FIXTURE_FILES['src/main.ts']}\n// touched\n`)
  report.entryTouch = {
    health: await pollUntil(getHealth, (h) => (h.json?.boot ?? 0) >= 4),
  }

  // 7. broken server graph answers 502, next edit recovers
  editFile('src/value.ts', `export const VALUE = 'v3' broken {{{\n`)
  const broken = await pollUntil(getHealth, (h) => h.status === 502)
  editFile('src/value.ts', `export const VALUE = 'v3'\n`)
  const fixed = await pollUntil(getHealth, (h) => h.json?.value === 'v3')
  report.brokenThenFixed = { broken, fixed }

  console.log(`__RESULT__ ${JSON.stringify(report)}`)
} finally {
  await server?.close()
  rmSync(FIXTURE_ROOT, { recursive: true, force: true })
}
