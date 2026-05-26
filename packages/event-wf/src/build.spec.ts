import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// Regression for BUNDLE_BUG.md: the build script must externalize subpath
// imports of declared dependencies, not just bare specifiers. If rolldown's
// `external:` is given a plain array, exact string match silently lets
// `@prostojs/wf/outlets` imports through and inlines the class bodies into
// the dist — drifting the published bundle away from the source the next
// time the upstream dep updates. This shipped @moostjs/event-wf@0.6.16
// with a frozen 2-arg HandleStateStrategy.persist; fixed in the next
// patch release.
//
// Skipped when the dist hasn't been built (so `pnpm test` standalone stays
// clean). Runs as a real assertion in the release pipeline, which builds
// before testing.
const distPath = resolve(__dirname, '../dist/index.mjs')
const distAvailable = existsSync(distPath)

describe.runIf(distAvailable)('event-wf dist externalization', () => {
  const dist = distAvailable ? readFileSync(distPath, 'utf8') : ''

  it('does not inline classes re-exported from @prostojs/wf/outlets', () => {
    for (const name of [
      'HandleStateStrategy',
      'EncapsulatedStateStrategy',
      'WfStateStoreMemory',
    ]) {
      expect(dist, `'${name}' class body was inlined into the bundle`).not.toMatch(
        new RegExp(`var ${name} = class`),
      )
    }
  })

  it('imports subpath symbols from @prostojs/wf/outlets at runtime', () => {
    expect(dist).toMatch(/from ["']@prostojs\/wf\/outlets["']/)
  })
})
