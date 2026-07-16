// oxlint-disable max-classes-per-file -- one isolated fixture per test case
import { beforeEach, describe, expect, it } from 'vitest'

import { Controller, Provide } from '../decorators'
import { setDefaultLogger } from '../logger'
import { Moost } from '../moost'
import { createCaptureLogger } from '../tests/capture-logger.artifacts'
import {
  findTokenProviders,
  formatInfactErrorContext,
  formatScopeHint,
  getDiagnosticsSourceCount,
  registerDiagnosticsSource,
  registerDiagnosticsSourceRef,
  resetDiagnosticsSources,
} from './diagnostics'
import { onInfactEvent } from './infact'

/**
 * Testing strategy: the pure formatting/scanning functions are unit-tested
 * directly for precision; the rich D2 wire format is ALSO driven end-to-end
 * through a real failing init() (installed @prostojs/infact ≥0.5.0 passes the
 * 5th `detail` payload). The 4-arg no-detail path is pinned by invoking the
 * exported handler directly — that is how pre-0.5 infact copies call it.
 */

beforeEach(() => {
  resetDiagnosticsSources()
})

describe('D2 formatInfactErrorContext', () => {
  it('renders class, param index, type, and hierarchy per the DIAG.md shape', () => {
    const text = formatInfactErrorContext(
      'UsersController',
      'Could not inject "DB_SPACE" argument with index 2',
      {
        paramIndex: 2,
        paramTypeName: 'Object',
        hierarchy: ['Moost', 'UsersController'],
      },
    )
    expect(text).toContain(
      'Failed to instantiate UsersController: constructor parameter #2 (type Object)',
    )
    expect(text).toContain('Could not inject "DB_SPACE" argument with index 2')
    expect(text).toContain('\n  Hierarchy: Moost → UsersController')
  })

  it('includes the param label and renders index 0 (typeof check, not truthiness)', () => {
    const text = formatInfactErrorContext('UsersController', 'Could not inject argument', {
      paramIndex: 0,
      paramLabel: 'db',
      paramTypeName: 'Object',
    })
    expect(text).toContain('constructor parameter #0 (label "db", type Object)')
    expect(text).not.toContain('Hierarchy:')
  })

  it('omits parts whose detail fields are absent', () => {
    const text = formatInfactErrorContext('Object', 'Class is not Injectable and not Optional.', {})
    expect(text).toBe('Failed to instantiate Object — Class is not Injectable and not Optional.')
  })

  it('omits the hierarchy line for an empty hierarchy array', () => {
    const text = formatInfactErrorContext('X', 'boom', { paramIndex: 1, hierarchy: [] })
    expect(text).toBe('Failed to instantiate X: constructor parameter #1 — boom')
  })
})

describe('D4 findTokenProviders / registerDiagnosticsSource', () => {
  it('finds a string token class-provided on a sibling controller of an initialized app', async () => {
    @Controller()
    @Provide('DB_SPACE', () => 'space-a')
    class OrdersController {}

    @Controller()
    class UsersController {}

    const { logger } = createCaptureLogger()
    const app = new Moost({ logger })
    app.registerControllers(OrdersController, UsersController)
    await app.init() // init() registers the app as a diagnostics source

    expect(findTokenProviders('DB_SPACE')).toEqual(['OrdersController'])
  })

  it('finds a class token by symbol identity (the @Inject normalization)', async () => {
    class DbSpace {}

    @Controller()
    @Provide(DbSpace, () => new DbSpace())
    class ClassTokenProviderController {}

    const { logger } = createCaptureLogger()
    const app = new Moost({ logger })
    app.registerControllers(ClassTokenProviderController)
    await app.init()

    // @Inject(DbSpace) normalizes the class token to the same global symbol
    const token = Symbol.for(String(DbSpace))
    expect(findTokenProviders(token)).toEqual(['ClassTokenProviderController'])
  })

  it('returns an empty list for an unknown token', async () => {
    const { logger } = createCaptureLogger()
    const app = new Moost({ logger })
    await app.init()

    expect(findTokenProviders('NEVER_PROVIDED')).toEqual([])
  })

  it('re-registering the same source is a no-op', () => {
    const source = { getControllersOverview: () => [] }
    registerDiagnosticsSource(source)
    registerDiagnosticsSource(source)
    expect(getDiagnosticsSourceCount()).toBe(1)
  })

  it('prunes refs whose target was collected', () => {
    // GC cannot be forced from a test, so the prune path is covered through
    // the ref-level unit seam: a ref whose deref() returns undefined models a
    // WeakRef to a collected app.
    registerDiagnosticsSource({ getControllersOverview: () => [] })
    registerDiagnosticsSourceRef({ deref: () => undefined })
    expect(getDiagnosticsSourceCount()).toBe(2)

    expect(findTokenProviders('ANY')).toEqual([]) // the scan prunes dead refs
    expect(getDiagnosticsSourceCount()).toBe(1)
  })
})

describe('D4 formatScopeHint', () => {
  it('includes the token, the provider, the scoping rule, and both remedies', () => {
    const hint = formatScopeHint('DB_SPACE', ['OrdersController'])
    expect(hint).toContain('Token "DB_SPACE" is provided on sibling controller OrdersController')
    expect(hint).toContain('class-scoped @Provide')
    expect(hint).toContain('providers flow parent → child through @ImportController')
    expect(hint).toContain('never to siblings')
    expect(hint).toContain('app.setProvideRegistry(...)')
    expect(hint).toContain('common parent @ImportController')
  })

  it('lists multiple providers', () => {
    expect(formatScopeHint('T', ['A', 'B'])).toContain('sibling controllers A, B')
  })

  it('returns undefined when no providers were found', () => {
    expect(formatScopeHint('DB_SPACE', [])).toBeUndefined()
  })

  it('stringifies symbol tokens readably', () => {
    expect(formatScopeHint(Symbol.for('MY_SYM'), ['A'])).toContain('Token "MY_SYM"')
    // class tokens are keyed by Symbol.for(<class source>) — render the class name
    expect(formatScopeHint(Symbol.for('class DbSpace {\n}'), ['A'])).toContain('Token "DbSpace"')
  })
})

describe("on('error') wire formats", () => {
  it('a real failing init() (infact ≥0.5 wire) logs the rich D2 format with consumer context', async () => {
    class NotInjectable {}

    @Controller()
    class BrokenController {
      constructor(private dep: NotInjectable) {}
    }

    const { logger, errors } = createCaptureLogger()
    const app = new Moost({ logger })
    app.registerControllers(BrokenController)

    await expect(app.init()).rejects.toThrow(/not Injectable and not Optional/)
    const joined = errors.join('\n')
    // outer event names the consumer, the param position, and the type
    expect(joined).toContain(
      'Failed to instantiate BrokenController: constructor parameter #0 (type NotInjectable)',
    )
    expect(joined).toContain('Hierarchy: BrokenController → NotInjectable')
    // a real class (value import) must not trigger the import-type hint
    expect(joined).not.toContain('import type')
  })

  it('invoking the exported handler with 4 args produces exactly the legacy format', () => {
    const { logger, errors } = createCaptureLogger()
    setDefaultLogger(logger)
    class LegacyTarget {}

    onInfactEvent('error', LegacyTarget, 'Class is not Injectable and not Optional.', [
      'Moost',
      'LegacyTarget',
    ])

    // __DYE_*__ constants are defined as '' in vitest, so the string is exact
    expect(errors).toEqual([
      'Failed to instantiate LegacyTarget. Class is not Injectable and not Optional. ⋱ Moost → LegacyTarget',
    ])
  })
})

describe('forward compatibility — detail passed by a newer infact', () => {
  it('renders the D2 context and appends the D4 sibling-provider hint', async () => {
    @Controller()
    @Provide('FWD_DB_SPACE', () => 'space')
    class SiblingProviderController {}

    @Controller()
    class ConsumerController {}

    const { logger, errors } = createCaptureLogger()
    const app = new Moost({ logger })
    app.registerControllers(SiblingProviderController, ConsumerController)
    await app.init()

    // wire-level call shape that activates once infact ships TInfactEventDetail
    onInfactEvent(
      'error',
      ConsumerController,
      'Could not inject "FWD_DB_SPACE" argument with index 1',
      ['Moost', 'ConsumerController'],
      {
        injectToken: 'FWD_DB_SPACE',
        paramIndex: 1,
        paramTypeName: 'Object',
        hierarchy: ['Moost', 'ConsumerController'],
      },
    )

    expect(errors).toHaveLength(1)
    const logged = errors[0]
    expect(logged).toContain(
      'Failed to instantiate ConsumerController: constructor parameter #1 (type Object)',
    )
    expect(logged).toContain('Could not inject "FWD_DB_SPACE" argument with index 1')
    expect(logged).toContain('Hierarchy: Moost → ConsumerController')
    expect(logged).toContain(
      'Token "FWD_DB_SPACE" is provided on sibling controller SiblingProviderController',
    )
    expect(logged).toContain('app.setProvideRegistry(...)')
    expect(logged).toContain('common parent @ImportController')
  })

  it('skips the hint when the detail token is not provided anywhere', async () => {
    const { logger, errors } = createCaptureLogger()
    const app = new Moost({ logger })
    await app.init()

    onInfactEvent(
      'error',
      class OrphanConsumer {},
      'Could not inject "GHOST" argument with index 0',
      ['OrphanConsumer'],
      { injectToken: 'GHOST', paramIndex: 0, hierarchy: ['OrphanConsumer'] },
    )

    expect(errors).toHaveLength(1)
    expect(errors[0]).toContain('constructor parameter #0')
    expect(errors[0]).not.toContain('sibling')
  })
})
