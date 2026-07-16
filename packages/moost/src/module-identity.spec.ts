import { afterEach, describe, expect, it, vi } from 'vitest'

import { getMoostMate } from './metadata'
import type { TMoostModuleIdentity } from './module-identity'
import { MOOST_MODULE_IDENTITY_KEY, stampModuleIdentity, stampOnce } from './module-identity'

type TIdentityHolder = Record<symbol, TMoostModuleIdentity | undefined>

describe('module-identity', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    // the module import stamps the real globalThis at module scope
    delete (globalThis as unknown as TIdentityHolder)[MOOST_MODULE_IDENTITY_KEY]
  })

  it('must stamp globalThis when the package is imported', () => {
    const stamp = (globalThis as unknown as TIdentityHolder)[MOOST_MODULE_IDENTITY_KEY]
    expect(stamp).toBeDefined()
    expect(typeof stamp?.version).toBe('string')
    expect(stamp?.path).toContain('module-identity')
  })

  it('must not warn on the first stamp', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const fakeGlobal: TIdentityHolder = {}
    const identity = { version: '1.0.0', path: 'file:///first.mjs' }

    stampModuleIdentity(identity, fakeGlobal)

    expect(warn).not.toHaveBeenCalled()
    expect(fakeGlobal[MOOST_MODULE_IDENTITY_KEY]).toEqual(identity)
  })

  it('must warn on a duplicate stamp and keep the first identity', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const first = { version: '1.0.0', path: 'file:///first.mjs' }
    const fakeGlobal: TIdentityHolder = {
      [MOOST_MODULE_IDENTITY_KEY]: first,
    }

    stampModuleIdentity({ version: '2.0.0', path: 'file:///second.mjs' }, fakeGlobal)

    expect(warn).toHaveBeenCalledTimes(1)
    const message = warn.mock.calls[0][0] as string
    expect(message).toContain('[moost] A second copy of moost was loaded')
    expect(message).toContain('1.0.0 at file:///first.mjs')
    expect(message).toContain('now 2.0.0 at file:///second.mjs')
    expect(message).toContain('will NOT interoperate between copies')
    expect(message).toContain('Check your bundler config / dedupe settings')
    expect(fakeGlobal[MOOST_MODULE_IDENTITY_KEY]).toBe(first)
  })

  it('must latch stampOnce per module copy (getMoostMate path stays silent)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    // pre-seed a foreign stamp — a re-run of the un-latched stamp would warn
    ;(globalThis as unknown as TIdentityHolder)[MOOST_MODULE_IDENTITY_KEY] = {
      version: '9.9.9',
      path: 'file:///foreign.mjs',
    }

    // this copy already stamped at import time — both the direct call and
    // the reachable getMoostMate() call must be no-ops
    stampOnce()
    getMoostMate()

    expect(warn).not.toHaveBeenCalled()
  })

  it('must describe unknown version/path gracefully', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const fakeGlobal: TIdentityHolder = {
      [MOOST_MODULE_IDENTITY_KEY]: {},
    }

    stampModuleIdentity({}, fakeGlobal)

    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0][0] as string).toContain('unknown version at unknown path')
  })
})
