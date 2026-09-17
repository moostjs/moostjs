// oxlint-disable max-lines -- the fixture app's sources are inlined below
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
 * `src/failing.ts` in its healthy (`fail: false`) or boot-breaking variant.
 * `FailOwner` opens its resource during `init()`; `FailController`, registered
 * after it, throws in the `fail` variant — so the boot dies *after* a provider
 * made it into the DI registry. Both live in one module on purpose: editing it
 * is what ejects (and therefore disposes) the instance the failed boot left
 * behind, since esbuild emits no `design:paramtypes` for a dependency-based
 * eject (see the note on the fixture below).
 */
const failingSource = (fail) => `import { Injectable, MoostDispose } from 'moost'

import { globalLog, nextId } from './fixture-state'

const failLog = () => globalLog('__fixture_fail_log')

@Injectable()
export class FailOwner {
  id = nextId('__fixture_fail_seq')

  constructor() {
    failLog().push('failopen:' + String(this.id))
  }

  @MoostDispose()
  close() {
    failLog().push('failclose:' + String(this.id))
  }
}

@Injectable()
export class FailController {
  constructor() {
${fail ? "    throw new Error('fixture boot failure')" : '    // this variant boots fine'}
  }
}
`

/**
 * Fullstack fixture (middleware: true + prefix + ssrEntry) with three distinct
 * module graphs sharing one Vite dev server:
 * - Moost entry graph:   main.ts → controller.ts → value.ts + config.json,
 *                        plus resource.ts, jobs.ts and failing.ts, which share
 *                        the never-edited fixture-state.ts leaf (imported by,
 *                        never importing, the edited modules — so it never
 *                        widens an eject set)
 * - SSR render graph:    entry-server.ts → note.ts (loaded via server.ssrLoadModule)
 * - client-only graph:   ui/notify.ts (loaded only by the browser)
 *
 * `resource.ts` holds the disposal fixtures: a singleton that "opens" a fake
 * resource on construction and releases it from a `@MoostDispose` hook, plus a
 * sibling whose hook throws. `jobs.ts` owns a recurring timer (the "duplicated
 * job per reload" shape), `failing.ts` the partially-failed-boot shape. All are
 * registered explicitly rather than constructor-injected because Vite transforms
 * TS with esbuild, which never emits `design:paramtypes` — what matters here is
 * that they are SINGLETON `@Injectable()` instances living in the DI registry,
 * exactly like an injected provider.
 *
 * The entry keeps the documented order (`listen()`, then an un-awaited `init()`):
 * the plugin captures and awaits the init promise itself, so a boot that dies
 * inside `init()` answers 502 instead of serving half-bound routes.
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
import { FailController, FailOwner } from './failing'
import { JobRunner } from './jobs'
import { ReadyMarker } from './ready'
import { BrokenResource, ResourceOwner } from './resource'

const g = globalThis as Record<string, unknown>
g.__fixture_boot = ((g.__fixture_boot as number) ?? 0) + 1

const app = new Moost()
const http = new MoostHttp()
app.adapter(http).listen(3000)
app.registerControllers(
  ApiController,
  ResourceOwner,
  BrokenResource,
  JobRunner,
  ReadyMarker,
  FailOwner,
  FailController,
)
void app.init()
`,
  'src/controller.ts': `import { Controller } from 'moost'
import { Get } from '@moostjs/event-http'

import config from './config.json'
import { resourceLog } from './resource'
import { VALUE } from './value'

@Controller('api')
export class ApiController {
  @Get('health')
  health() {
    const g = globalThis as Record<string, unknown>
    return {
      ok: true,
      boot: g.__fixture_boot as number,
      value: VALUE,
      tag: (config as { tag: string }).tag,
      res: resourceLog(),
      // Read off globalThis rather than imported: importing jobs.ts/failing.ts
      // here would widen their importer set and eject this controller too.
      jobs: (g.__fixture_job_log as string[]) ?? [],
      ticks: (g.__fixture_job_ticks as Record<string, number>) ?? {},
      fails: (g.__fixture_fail_log as string[]) ?? [],
      ready: (g.__fixture_ready as number) ?? 0,
    }
  }
}
`,
  'src/fixture-state.ts': `const g = globalThis as Record<string, unknown>

/** A log that survives reloads on globalThis, so the test can compare across boots. */
export function globalLog(key: string): string[] {
  const log = (g[key] as string[]) ?? []
  g[key] = log
  return log
}

/** Next value of the per-key id sequence kept on globalThis (1, 2, 3, … across boots). */
export function nextId(key: string): number {
  const id = ((g[key] as number) ?? 0) + 1
  g[key] = id
  return id
}
`,
  'src/resource.ts': `import { Injectable, MoostDispose } from 'moost'

import { globalLog } from './fixture-state'

const g = globalThis as Record<string, unknown>

/** Re-exported so controller.ts keeps importing resource.ts (its eject set is part of the test). */
export const resourceLog = () => globalLog('__fixture_res_log')

@Injectable()
export class ResourceOwner {
  boot = g.__fixture_boot as number

  constructor() {
    resourceLog().push('open:' + String(this.boot))
  }

  @MoostDispose()
  async close() {
    await new Promise((resolve) => setTimeout(resolve, 20))
    resourceLog().push('close:' + String(this.boot))
  }
}

@Injectable()
export class BrokenResource {
  @MoostDispose()
  close() {
    throw new Error('fixture dispose failure')
  }
}
`,
  'src/jobs.ts': `import { Injectable, MoostDispose } from 'moost'

import { globalLog, nextId } from './fixture-state'

const g = globalThis as Record<string, unknown>

const jobLog = () => globalLog('__fixture_job_log')

@Injectable()
export class JobRunner {
  id = nextId('__fixture_job_seq')

  timer: any = null

  constructor() {
    jobLog().push('start:' + String(this.id))
    this.timer = setInterval(() => {
      const ticks = (g.__fixture_job_ticks as Record<string, number>) ?? {}
      ticks[String(this.id)] = (ticks[String(this.id)] ?? 0) + 1
      g.__fixture_job_ticks = ticks
    }, 20)
    // Unref'd so a leaked interval cannot keep this driver process alive —
    // a missed dispose must show up as a ticking counter, not as a hang.
    this.timer.unref()
  }

  @MoostDispose()
  stop() {
    clearInterval(this.timer)
    jobLog().push('stop:' + String(this.id))
  }
}
`,
  'src/failing.ts': failingSource(false),
  'src/ready.ts': `import { Controller, MoostInit } from 'moost'

const g = globalThis as Record<string, unknown>

/**
 * Stamps the current boot number into \`__fixture_ready\`, but only after a real
 * delay — so an app that is merely *evaluated* (entry ran, \`init()\` still in
 * flight) reports a \`ready\` that lags its \`boot\`.
 */
@Controller()
export class ReadyMarker {
  @MoostInit()
  async markReady() {
    await new Promise((resolve) => setTimeout(resolve, 150))
    g.__fixture_ready = g.__fixture_boot
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

/**
 * Tee stdout/stderr so the report can assert on the plugin's disposal logging
 * (the `♻️ Disposed` debug lines and the "reload continues" warnings), which is
 * console output, not part of any HTTP response.
 */
const ANSI = new RegExp(`${String.fromCodePoint(27)}\\[[0-9;]*m`, 'g')
const disposeLogLines = []
for (const stream of [process.stdout, process.stderr]) {
  const write = stream.write.bind(stream)
  stream.write = (chunk, ...rest) => {
    const text = typeof chunk === 'string' ? chunk : String(chunk)
    for (const line of text.split('\n')) {
      if (line.includes('Dispose hook') || line.includes('Disposed "')) {
        disposeLogLines.push(line.replace(ANSI, '').trim())
      }
    }
    return write(chunk, ...rest)
  }
}

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

  // 8. editor bulk-save storm: every server-graph file saved twice in rapid
  // succession (mostly mtime churn) must coalesce into a single reload and a
  // single healthy pipeline — the incident class where per-wave DI cleanup
  // raced the lazy reload and left a stale pipeline serving with no limits.
  const stormWave = () => {
    editFile('src/value.ts', `export const VALUE = 'v4'\n`)
    editFile('src/config.json', `{ "tag": "c" }\n`)
    editFile('src/controller.ts', FIXTURE_FILES['src/controller.ts'])
    editFile('src/main.ts', `${FIXTURE_FILES['src/main.ts']}\n// touched\n`)
  }
  stormWave()
  await sleep(80)
  stormWave()
  // let the watcher deliver both waves before any request triggers the lazy reload
  await sleep(600)
  const stormHealth = await pollUntil(getHealth, (h) => h.json?.value === 'v4')
  const hammer = await Promise.all(Array.from({ length: 8 }, getHealth))
  report.storm = {
    health: stormHealth,
    boots: [...new Set(hammer.map((h) => h.json?.boot))],
    hammerOk: hammer.every((h) => h.status === 200 && h.json?.value === 'v4'),
  }

  // 9. disposal on eject: editing the provider's own file ejects it, so its
  // @MoostDispose hook must run — awaited — before the replacement instance is
  // constructed by the new boot. The sibling provider whose hook throws must
  // warn without blocking the reload.
  const countOpens = (h) => (h.json?.res ?? []).filter((e) => e.startsWith('open:')).length
  const before = await getHealth()
  const opensBefore = countOpens(before)
  editFile('src/resource.ts', `${FIXTURE_FILES['src/resource.ts']}\n// touched\n`)
  const after = await pollUntil(getHealth, (h) => countOpens(h) > opensBefore)
  report.dispose = { before, after, log: disposeLogLines }

  // 10. repeated reloads with a live recurring job: each eject must stop the old
  // interval, so after three reloads in a row exactly ONE runtime is left ticking.
  const countStarts = (h) => (h.json?.jobs ?? []).filter((e) => e.startsWith('start:')).length
  let starts = countStarts(await getHealth())
  for (let i = 0; i < 3; i++) {
    const seen = starts
    editFile('src/jobs.ts', `${FIXTURE_FILES['src/jobs.ts']}\n// touched ${String(i)}\n`)
    starts = countStarts(await pollUntil(getHealth, (h) => countStarts(h) > seen))
  }
  // Two snapshots a few intervals apart: only the surviving runner's counter moves.
  const ticksFirst = await getHealth()
  await sleep(250)
  const ticksSecond = await getHealth()
  report.repeatedReloads = { first: ticksFirst, second: ticksSecond }

  // 11. a boot that dies inside init(): the boot below constructs FailOwner and
  // then throws in FailController's constructor. listen() already ran (documented
  // entry order), so an HTTP middleware IS captured — the plugin must still answer
  // 502 from the awaited init() rejection instead of serving the routes that were
  // bound before the failure. The next reload must also eject and dispose the
  // instance that failed boot left in the registry, BEFORE the healthy boot
  // constructs its replacement.
  editFile('src/failing.ts', failingSource(true))
  const failedBoot = await pollUntil(getHealth, (h) => h.status === 502)
  editFile('src/failing.ts', FIXTURE_FILES['src/failing.ts'])
  const recovered = await pollUntil(getHealth, (h) => h.status === 200 && h.json?.ok === true)
  report.failedStart = { failed: failedBoot, recovered }

  // 12. a request issued right after a reload is triggered must be answered by the
  // FULLY initialised new app. `boot` is bumped while the entry evaluates, `ready`
  // only by an @MoostInit hook that resolves 150ms later — so any answer from a
  // merely-evaluated app shows `ready` lagging `boot`. Hammer the server from the
  // moment of the edit until the new boot shows up and keep every sample.
  const readyBaseline = await getHealth()
  const readyBefore = readyBaseline.json?.boot ?? 0
  editFile('src/ready.ts', `${FIXTURE_FILES['src/ready.ts']}\n// touched\n`)
  const readySamples = []
  const readyDeadline = Date.now() + 15_000
  let readyLast = await getHealth()
  readySamples.push(readyLast)
  while ((readyLast.json?.boot ?? 0) <= readyBefore && Date.now() < readyDeadline) {
    readyLast = await getHealth()
    readySamples.push(readyLast)
  }
  // Only the offenders are reported (hundreds of samples otherwise): an answer is
  // an offender when it is not a healthy response from an app whose @MoostInit
  // hook has already run for the very boot that answered.
  report.readyGate = {
    before: readyBefore,
    count: readySamples.length,
    violations: readySamples.filter(
      (h) => h.status !== 200 || h.json?.ok !== true || h.json?.ready !== h.json?.boot,
    ),
    last: readyLast,
  }

  console.log(`__RESULT__ ${JSON.stringify(report)}`)
} finally {
  await server?.close()
  rmSync(FIXTURE_ROOT, { recursive: true, force: true })
}
