// oxlint-disable max-classes-per-file -- one isolated fixture per test case
import { createProvideRegistry, createReplaceRegistry } from '@prostojs/infact'
import { describe, expect, it } from 'vitest'

import type { TMoostAdapter } from './moost'
import { Moost } from './moost'
import { createCaptureLogger } from './tests/capture-logger.artifacts'

/** Peeks at the protected registries to assert merge behavior stays unchanged. */
function getRegistries(app: Moost) {
  return app as unknown as { provide: Record<string, unknown>; replace: Record<symbol, unknown> }
}

describe('D5 late registry guard', () => {
  it('setProvideRegistry before init() stays silent and merges', async () => {
    const { logger, warnings } = createCaptureLogger()
    const app = new Moost({ logger })

    app.setProvideRegistry(createProvideRegistry(['EARLY_TOKEN', () => 'early']))
    await app.init() // init() itself calls setProvideRegistry — must stay silent too

    expect(warnings).toHaveLength(0)
    expect(getRegistries(app).provide.EARLY_TOKEN).toBeDefined()
  })

  it('setProvideRegistry after init() warns but still merges', async () => {
    const { logger, warnings } = createCaptureLogger()
    const app = new Moost({ logger })
    await app.init()

    app.setProvideRegistry(createProvideRegistry(['LATE_TOKEN', () => 'late']))

    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toContain('setProvideRegistry() called after init()')
    expect(warnings[0]).toContain('already-bound controllers will not see these providers')
    expect(warnings[0]).toContain('Register providers before init()')
    // merge behavior is unchanged — the entry is still applied
    expect(getRegistries(app).provide.LATE_TOKEN).toBeDefined()
  })

  it('setReplaceRegistry after init() warns but still merges', async () => {
    class Original {}
    class Replacement {}

    const { logger, warnings } = createCaptureLogger()
    const app = new Moost({ logger })
    await app.init()

    const replace = createReplaceRegistry([Original, Replacement])
    app.setReplaceRegistry(replace)

    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toContain('setReplaceRegistry() called after init()')
    expect(warnings[0]).toContain('already-bound controllers will not see these replacements')
    const key = Object.getOwnPropertySymbols(replace)[0]
    expect(getRegistries(app).replace[key]).toBe(Replacement)
  })

  it('setReplaceRegistry before init() stays silent', async () => {
    class Original {}
    class Replacement {}

    const { logger, warnings } = createCaptureLogger()
    const app = new Moost({ logger })

    app.setReplaceRegistry(createReplaceRegistry([Original, Replacement]))
    await app.init()

    expect(warnings).toHaveLength(0)
  })

  it('adapter registrations during init() (getProvideRegistry / onInit) never warn', async () => {
    const { logger, warnings } = createCaptureLogger()
    const app = new Moost({ logger })

    const adapter: TMoostAdapter<unknown> = {
      name: 'fake',
      bindHandler() {},
      getProvideRegistry: () => createProvideRegistry(['ADAPTER_TOKEN', () => 'adapter']),
      onInit(moost) {
        moost.setProvideRegistry(createProvideRegistry(['ON_INIT_TOKEN', () => 'boot']))
      },
    }
    app.adapter(adapter)
    await app.init()

    expect(warnings).toHaveLength(0)
    expect(getRegistries(app).provide.ADAPTER_TOKEN).toBeDefined()
    expect(getRegistries(app).provide.ON_INIT_TOKEN).toBeDefined()
  })
})
