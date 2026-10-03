import { fileURLToPath } from 'node:url'
import { beforeAll, describe, expect, it } from 'vitest'

import { assertFreshBuilds, runDriver } from './driver-harness'

/**
 * Integration test: in dev, the app and an externalized dependency that
 * imports `@moostjs/event-http` itself (loaded natively by Node, like
 * `@atscript/moost-db`) must see ONE `MoostHttp` — the adapter the plugin
 * patches, the app attaches, and DI resolves for the dependency.
 *
 * Runs adapter-identity.driver.mjs in a child Node process against the BUILT
 * packages (see hot-update.spec.ts for why). Requires `pnpm build`.
 */

interface TReport {
  status: number
  /** Response body head — the error when `json` is null. */
  text: string
  json: { sameClass: boolean; viaExternal: string } | null
  warnings: string[]
}

const DRIVER = fileURLToPath(new URL('adapter-identity.driver.mjs', import.meta.url))

describe('moost-vite dev adapter identity', () => {
  let byDefault: TReport
  let forced: TReport

  beforeAll(async () => {
    assertFreshBuilds(['vite', 'moost', 'event-http'])
    ;[byDefault, forced] = await Promise.all(
      (['default', 'forced'] as const).map((scenario) =>
        runDriver<TReport>(DRIVER, [scenario], 120_000),
      ),
    )
  }, 240_000)

  it('shares one MoostHttp between the app and a natively loaded dependency', () => {
    // Before the fix the plugin loaded the adapter through the SSR module runner,
    // which evaluated its own copy: the dependency's `instantiate(MoostHttp)`
    // failed with "Class is not Injectable".
    expect(byDefault.status).toBe(200)
    expect(byDefault.json).toEqual({ sameClass: true, viaExternal: 'attached adapter' })
    expect(byDefault.warnings).toEqual([])
  })

  it('warns at startup when ssr.noExternal forces the adapter into the runner', () => {
    const warning = forced.warnings.find((w) => w.includes('loaded natively by Node in dev'))
    expect(warning).toBeDefined()
    expect(warning).toContain('ext-consumer depends on @moostjs/event-http (inlined)')
    expect(warning).toContain("add 'ext-consumer' to ssr.noExternal")
  })

  it('still resolves the attached adapter by brand across the forced split', () => {
    expect(forced.json).toEqual({ sameClass: false, viaExternal: 'attached adapter' })
  })
})
