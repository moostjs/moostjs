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
  json: { ok: boolean; boot: number; value: string; tag: string; res: string[] } | null
}

interface TReport {
  baseline: { health: THealth; page: string; clientMod: string }
  clientOnly: { first: THealth; second: THealth; clientMod: string }
  renderGraph: { page: string; health: THealth }
  serverGraph: { health: THealth }
  jsonFile: { health: THealth }
  entryTouch: { health: THealth }
  brokenThenFixed: { broken: THealth; fixed: THealth }
  storm: { health: THealth; boots: number[]; hammerOk: boolean }
  dispose: { before: THealth; after: THealth; log: string[] }
}

const DRIVER = fileURLToPath(new URL('hot-update.driver.mjs', import.meta.url))
const DIST = fileURLToPath(new URL('../dist/index.mjs', import.meta.url))
const SRC = fileURLToPath(new URL('../src', import.meta.url))
// The fixture app imports the BUILT `moost` (it is externalized in dev, see the
// driver), so a stale core build means missing `@MoostDispose`, not a red test.
const MOOST_DIST = fileURLToPath(new URL('../../moost/dist/index.mjs', import.meta.url))
const MOOST_SRC = fileURLToPath(new URL('../../moost/src', import.meta.url))

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
    if (!existsSync(MOOST_DIST)) {
      throw new Error('moost/dist/index.mjs missing — run `pnpm build moost` first')
    }
    if (statSync(MOOST_DIST).mtimeMs < newestSrcMtime(MOOST_SRC)) {
      throw new Error('moost/dist/index.mjs is older than src — run `pnpm build moost` first')
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
    // Nothing was ejected, so nothing was disposed either
    expect(report.clientOnly.second.json?.res).toEqual(['open:1'])
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

  it('coalesces a bulk-save storm into one reload and one healthy pipeline', () => {
    // Two waves of four files each → exactly one reload (per-wave ejects merge
    // into one pending cleanup consumed under the reload lock).
    expect(report.storm.health.json).toMatchObject({ ok: true, boot: 6, value: 'v4', tag: 'c' })
    // Every subsequent request is served by that single new pipeline.
    expect(report.storm.hammerOk).toBe(true)
    expect(report.storm.boots).toEqual([6])
  })

  it('disposes an ejected singleton once, before the replacement is constructed', () => {
    const log = report.dispose.after.json?.res ?? []
    const opens = log.filter((e) => e.startsWith('open:'))
    const closes = log.filter((e) => e.startsWith('close:'))

    // The provider's own file changed → the old instance was ejected and a new
    // one constructed on the next boot.
    expect(opens).toHaveLength(2)
    // Released exactly once — the leak this feature exists to prevent.
    expect(closes).toEqual([`close:${opens[0].slice('open:'.length)}`])
    // …and released BEFORE the replacement opened (the reload awaits disposal).
    expect(log.indexOf(closes[0])).toBeLessThan(log.indexOf(opens[1]))
    expect(report.dispose.log.some((l) => l.includes('Disposed "ResourceOwner"'))).toBe(true)
  })

  it('keeps reloading when a dispose hook throws', () => {
    // The sibling provider's hook throws on every eject; the app still reloads.
    expect(report.dispose.after.status).toBe(200)
    expect(report.dispose.after.json?.ok).toBe(true)
    expect(
      report.dispose.log.some(
        (l) => l.includes('BrokenResource') && l.includes('the reload continues'),
      ),
    ).toBe(true)
  })
})
