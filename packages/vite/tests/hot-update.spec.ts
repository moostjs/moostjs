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
  json: {
    ok: boolean
    boot: number
    value: string
    tag: string
    res: string[]
    jobs: string[]
    ticks: Record<string, number>
    fails: string[]
    ready: number
  } | null
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
  repeatedReloads: { first: THealth; second: THealth }
  failedStart: { failed: THealth; recovered: THealth }
  readyGate: { before: number; count: number; violations: THealth[]; last: THealth }
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

  it('leaves exactly one recurring job alive after three reloads in a row', () => {
    const jobs = report.repeatedReloads.second.json?.jobs ?? []
    const starts = jobs.filter((e) => e.startsWith('start:'))
    const stops = jobs.filter((e) => e.startsWith('stop:'))

    // One runner at boot + one per reload; every ejected one was stopped.
    expect(starts).toEqual(['start:1', 'start:2', 'start:3', 'start:4'])
    expect(stops).toEqual(['stop:1', 'stop:2', 'stop:3'])
    expect(jobs.at(-1)).toBe('start:4')

    // …and only the surviving runner's interval is still firing: every older id
    // froze at the tick count it had when its dispose hook cleared the timer.
    const before = report.repeatedReloads.first.json?.ticks ?? {}
    const after = report.repeatedReloads.second.json?.ticks ?? {}
    const moved = Object.keys(after).filter((id) => (after[id] ?? 0) > (before[id] ?? 0))
    expect(moved).toEqual(['4'])
  })

  it('answers 502 for a boot that failed inside init(), and disposes what it left behind', () => {
    // The boot died in a controller constructor — after a provider had already
    // been constructed, and AFTER listen() captured a middleware (the documented
    // entry order): the plugin awaits the entry's un-awaited init() and gates on
    // the error, instead of serving the routes bound before the failure.
    expect(report.failedStart.failed.status).toBe(502)
    expect(report.failedStart.failed.text).toContain('Moost app failed to load')
    expect(report.failedStart.failed.json).toBe(null)

    const fails = report.failedStart.recovered.json?.fails ?? []
    const opens = fails.filter((e) => e.startsWith('failopen:'))
    const closes = fails.filter((e) => e.startsWith('failclose:'))

    // boot → failed boot → recovery boot, each disposing its predecessor.
    expect(opens).toEqual(['failopen:1', 'failopen:2', 'failopen:3'])
    // The instance the FAILED boot created was disposed…
    expect(closes).toEqual(['failclose:1', 'failclose:2'])
    // …before the healthy boot constructed its replacement.
    expect(fails.indexOf('failclose:2')).toBeLessThan(fails.indexOf('failopen:3'))
    expect(report.failedStart.recovered.json?.ok).toBe(true)
  })

  it('never answers a request from a half-initialised app during a reload', () => {
    const { before, count, violations, last } = report.readyGate

    // The reload did happen…
    expect(count).toBeGreaterThan(0)
    expect(last.json?.boot).toBeGreaterThan(before)
    // …and every answer in between came from a fully booted app: the @MoostInit
    // hook stamps `ready` 150ms after the entry bumps `boot`, so a response served
    // between module evaluation and the end of init() would carry the new `boot`
    // with the previous boot's `ready` (or fall through to the SPA fallback).
    expect(violations).toEqual([])
    expect(last.json?.ready).toBe(last.json?.boot)
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
