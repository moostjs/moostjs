import { describe, expect, it } from 'vitest'

import { Moost } from './moost'
import { createCaptureLogger } from './tests/capture-logger.artifacts'
import { claimWooks } from './wooks-owner'

function app() {
  const capture = createCaptureLogger()
  return { app: new Moost({ logger: capture.logger }), warnings: capture.warnings }
}

describe('claimWooks()', () => {
  it('warns once per Wooks instance, on the second app, with that app logger', () => {
    const wooks = {}
    const a = app()
    const b = app()
    const c = app()
    claimWooks(a.app, wooks, 'http', { created: true })
    expect(a.warnings).toEqual([])
    claimWooks(b.app, wooks, 'http', { created: true })
    expect(b.warnings).toHaveLength(1)
    expect(b.warnings[0]).toContain('"http"')
    expect(b.warnings[0]).toContain('clearGlobalWooks()')
    // a third app, or another adapter kind on the same Wooks: already warned
    claimWooks(c.app, wooks, 'http', { created: true })
    claimWooks(c.app, wooks, 'cli', { created: true })
    claimWooks(a.app, wooks, 'cli', { created: true })
    expect([...a.warnings, ...b.warnings, ...c.warnings]).toHaveLength(1)
  })

  it('the same app claiming again (re-init) does not warn', () => {
    const wooks = {}
    const a = app()
    claimWooks(a.app, wooks, 'http', { created: true })
    claimWooks(a.app, wooks, 'http', { created: true })
    claimWooks(a.app, wooks, 'workflow', { created: true })
    expect(a.warnings).toEqual([])
  })

  it('separate Wooks instances, or different adapters on one, do not warn', () => {
    const a = app()
    const b = app()
    claimWooks(a.app, {}, 'http', { created: true })
    claimWooks(b.app, {}, 'http', { created: true })
    const shared = {}
    claimWooks(a.app, shared, 'http', { created: true })
    claimWooks(b.app, shared, 'cli', { created: true })
    expect([...a.warnings, ...b.warnings]).toEqual([])
  })

  it('apps sharing a Wooks app passed in on purpose stay silent; one created claim warns', () => {
    const a = app()
    const b = app()
    const deliberate = {}
    claimWooks(a.app, deliberate, 'http')
    claimWooks(b.app, deliberate, 'http', { created: false })
    expect([...a.warnings, ...b.warnings]).toEqual([])
    // either side created its app (landed on the global Wooks): warns
    const first = {}
    claimWooks(a.app, first, 'http', { created: true })
    claimWooks(b.app, first, 'http')
    const second = {}
    claimWooks(a.app, second, 'http')
    claimWooks(b.app, second, 'http', { created: true })
    expect(b.warnings).toHaveLength(2)
  })
})
