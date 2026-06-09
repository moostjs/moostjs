import { execFile } from 'node:child_process'
import { existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { beforeAll, describe, expect, it } from 'vitest'

/**
 * Integration test for the scoped hot reload behavior of the moost-vite plugin.
 *
 * The scenario runs in a child Node process (see hot-update.driver.mjs) against
 * the BUILT plugin, because the plugin must share the native `moost` /
 * `@moostjs/event-http` module instances with its fixture app — vitest's module
 * runner would inline its own copies of the workspace-linked packages, making
 * DI cleanup operate on the wrong singletons (impossible in a real app).
 *
 * Requires `pnpm build vite` to have run.
 */

interface THealth {
  status: number
  text: string
  json: { ok: boolean; boot: number; value: string; tag: string } | null
}

interface TReport {
  baseline: { health: THealth; page: string; clientMod: string }
  clientOnly: { first: THealth; second: THealth; clientMod: string }
  renderGraph: { page: string; health: THealth }
  serverGraph: { health: THealth }
  jsonFile: { health: THealth }
  entryTouch: { health: THealth }
  brokenThenFixed: { broken: THealth; fixed: THealth }
}

const DRIVER = fileURLToPath(new URL('hot-update.driver.mjs', import.meta.url))
const DIST = fileURLToPath(new URL('../dist/index.mjs', import.meta.url))
const SRC = fileURLToPath(new URL('../src', import.meta.url))

/** Newest mtime across the plugin sources — guards against testing a stale build. */
function newestSrcMtime(dir: string): number {
  let newest = 0
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = join(dir, entry.name)
    newest = Math.max(newest, entry.isDirectory() ? newestSrcMtime(abs) : statSync(abs).mtimeMs)
  }
  return newest
}

let report: TReport

describe('moost-vite scoped hot reload', () => {
  beforeAll(async () => {
    if (!existsSync(DIST)) {
      throw new Error('dist/index.mjs missing — run `pnpm build vite` first')
    }
    if (statSync(DIST).mtimeMs < newestSrcMtime(SRC)) {
      throw new Error('dist/index.mjs is older than src — run `pnpm build vite` first')
    }
    const { stdout } = await promisify(execFile)('node', [DRIVER], {
      timeout: 180_000,
      maxBuffer: 10 * 1024 * 1024,
    })
    const line = stdout.split('\n').find((l) => l.startsWith('__RESULT__'))
    if (!line) {
      throw new Error(`driver produced no result. Output:\n${stdout}`)
    }
    report = JSON.parse(line.slice('__RESULT__'.length)) as TReport
  }, 240_000)

  it('serves the API, the SSR page and the client module', () => {
    expect(report.baseline.health.status).toBe(200)
    expect(report.baseline.health.json).toMatchObject({ ok: true, boot: 1, value: 'v1', tag: 'a' })
    expect(report.baseline.page).toContain('NOTE_v1')
    expect(report.baseline.clientMod).toContain('toast_v1')
  })

  it('keeps the API alive when a client-only module changes', () => {
    // Before the fix the first request after the edit returned index.html
    // (SPA fallback) — permanently, for every /api request.
    expect(report.clientOnly.first.json?.ok).toBe(true)
    expect(report.clientOnly.second.json).toMatchObject({ ok: true, boot: 1, value: 'v1' })
    // Default client HMR pipeline still serves the fresh module
    expect(report.clientOnly.clientMod).toContain('toast_v2')
  })

  it('refreshes the SSR render graph without rebooting Moost', () => {
    expect(report.renderGraph.page).toContain('NOTE_v2')
    expect(report.renderGraph.health.json).toMatchObject({ ok: true, boot: 1 })
  })

  it('reloads the app when a server-graph module changes', () => {
    expect(report.serverGraph.health.json).toMatchObject({ ok: true, boot: 2, value: 'v2' })
  })

  it('reloads the app when a non-ts entry-graph file changes', () => {
    expect(report.jsonFile.health.json).toMatchObject({ ok: true, boot: 3, tag: 'b' })
  })

  it('reloads the app when the entry itself changes', () => {
    expect(report.entryTouch.health.json).toMatchObject({ ok: true, boot: 4 })
  })

  it('answers 502 while the server graph is broken, recovers on the next edit', () => {
    expect(report.brokenThenFixed.broken.status).toBe(502)
    expect(report.brokenThenFixed.broken.text).toContain('Moost app failed to load')
    // The failed boot does not increment the counter (imports fail before the
    // entry body runs); the recovery boot does.
    expect(report.brokenThenFixed.fixed.json).toMatchObject({ ok: true, boot: 5, value: 'v3' })
  })
})
