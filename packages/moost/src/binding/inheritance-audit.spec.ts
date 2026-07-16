// oxlint-disable max-classes-per-file -- one isolated class hierarchy per test case
// oxlint-disable no-useless-constructor -- re-declared pass-through constructors ARE the fixture (own design:paramtypes emission)
import { describe, expect, it } from 'vitest'

import { Controller } from '../decorators/controller.decorator'
import { Inherit } from '../decorators/inherit.decorator'
import { Injectable } from '../decorators/injectable.decorator'
import type { TMoostOptions } from '../moost'
import { Moost } from '../moost'
import { createCaptureLogger } from '../tests/capture-logger.artifacts'
import { FakeGet } from '../tests/fake-route.artifacts'

@Injectable()
class Dep {
  value = 42
}

@Controller('base')
class BaseCrudController {
  constructor(public dep: Dep) {}

  @FakeGet('list')
  list() {
    return []
  }

  @FakeGet('read')
  read() {
    return {}
  }
}

async function initApp(controller: object | Function, diagnostics?: TMoostOptions['diagnostics']) {
  const { logger, warnings } = createCaptureLogger()
  const app = new Moost({ logger, diagnostics })
  app.registerControllers(controller)
  await app.init()
  return warnings
}

describe('inheritance audit — route-drop trap', () => {
  it('warns when a decorated subclass registers 0 handlers while its ancestor defines some', async () => {
    @Controller('users')
    class UsersController extends BaseCrudController {
      constructor(dep: Dep) {
        super(dep)
      }
    }

    const warnings = await initApp(UsersController)
    const joined = warnings.join('\n')
    expect(joined).toContain(
      'UsersController extends BaseCrudController which defines 2 route handler(s), ' +
        'but UsersController registered 0 and has no @Inherit()',
    )
    expect(joined).toContain('Add @Inherit() or re-declare the routes.')
  })

  it('is silent when @Inherit() is present (routes flow)', async () => {
    @Inherit()
    class InheritedController extends BaseCrudController {}

    const warnings = await initApp(InheritedController)
    expect(warnings).toHaveLength(0)
  })

  it('warns with the gap variant when @Inherit() is present but an undecorated intermediate breaks the chain', async () => {
    class RouteGapMiddle extends BaseCrudController {}

    @Inherit()
    class RouteGapController extends RouteGapMiddle {}

    const warnings = await initApp(RouteGapController)
    const joined = warnings.join('\n')
    expect(joined).toContain(
      'RouteGapController has @Inherit() but registered 0 route handler(s) while its ancestor ' +
        'BaseCrudController defines 2',
    )
    expect(joined).toContain('the intermediate class(es) RouteGapMiddle carry no @Inherit()')
    expect(joined).toContain('Add @Inherit() to each intermediate class or re-declare the routes.')
  })

  it('is silent for a deliberate class-level @Inherit(false) opt-out', async () => {
    @Inherit(false)
    class OptedOutController extends BaseCrudController {}

    const warnings = await initApp(OptedOutController)
    expect(warnings.join('\n')).not.toContain('route handler(s)')
  })

  it('is silent when the subclass re-declares its own routes', async () => {
    @Controller('own')
    class OwnRoutesController extends BaseCrudController {
      constructor(dep: Dep) {
        super(dep)
      }

      @FakeGet('list')
      override list() {
        return []
      }
    }

    const warnings = await initApp(OwnRoutesController)
    expect(warnings).toHaveLength(0)
  })

  it('is silent when the class genuinely has no decorated ancestor', async () => {
    class PlainBase {}

    @Controller('standalone')
    class StandaloneController extends PlainBase {
      constructor(public dep: Dep) {
        super()
      }
    }

    const warnings = await initApp(StandaloneController)
    expect(warnings).toHaveLength(0)
  })

  it("is silenced by diagnostics: { inheritance: 'off' }", async () => {
    @Controller('users-off')
    class OffController extends BaseCrudController {
      constructor(dep: Dep) {
        super(dep)
      }
    }

    const warnings = await initApp(OffController, { inheritance: 'off' })
    expect(warnings).toHaveLength(0)
  })
})

describe('inheritance audit — lost-constructor-params trap', () => {
  it('warns for the portal case: subclass with NO own metadata at all over a decorated ancestor', async () => {
    class BareSubController extends BaseCrudController {}

    const warnings = await initApp(BareSubController)
    const joined = warnings.join('\n')
    // both traps fire: routes dropped AND ctor params unresolvable
    expect(joined).toContain('BareSubController extends BaseCrudController which defines 2')
    expect(joined).toContain(
      'BareSubController extends BaseCrudController whose constructor declares 1 DI param(s), ' +
        'but BareSubController carries no Moost metadata of its own',
    )
    expect(joined).toContain('Add @Inherit() to BareSubController or re-declare the constructor.')
  })

  it('warns when an undecorated intermediate class breaks the ctor-params fallback', async () => {
    class GapMiddle extends BaseCrudController {}

    @Controller('gap')
    class GapController extends GapMiddle {}

    const warnings = await initApp(GapController)
    const joined = warnings.join('\n')
    expect(joined).toContain(
      'GapController has no constructor param metadata, but its ancestor BaseCrudController ' +
        'declares 1 constructor param(s)',
    )
    // the advice names the fix that actually works: bridging the gap itself
    // (@Inherit() on GapController alone cannot cross an undecorated level)
    expect(joined).toContain('add @Inherit() to the intermediate class(es) (GapMiddle)')
  })

  it('never throws — findings are warn-only even in default dev mode', async () => {
    class WarnOnlySub extends BaseCrudController {}

    // initApp resolving IS the assertion (paramTypes defaults to 'error' in dev)
    const warnings = await initApp(WarnOnlySub)
    expect(warnings.length).toBeGreaterThan(0)
  })

  it('is silent when @Inherit() carries the params through', async () => {
    @Inherit()
    class InheritParams extends BaseCrudController {}

    const warnings = await initApp(InheritParams)
    expect(warnings).toHaveLength(0)
  })

  it('is silent for a decorated subclass without own ctor — the automatic fallback covers it', async () => {
    @Controller('auto')
    class AutoParamsController extends BaseCrudController {}

    const warnings = await initApp(AutoParamsController)
    // the route-drop warning still fires (routes DO drop) ...
    expect(warnings.join('\n')).toContain('route handler(s)')
    // ... but ctor params resolved via the fallback — no ctor-params warning
    expect(warnings.join('\n')).not.toContain('constructor param')
  })

  it('is silent for an own zero-param constructor (deliberate params: [])', async () => {
    @Controller('zeroctor')
    class ZeroCtorController extends BaseCrudController {
      constructor() {
        super(new Dep())
      }

      @FakeGet('own')
      own() {
        return 'own'
      }
    }

    const warnings = await initApp(ZeroCtorController)
    expect(warnings).toHaveLength(0)
  })

  it("is silenced by diagnostics: { inheritance: 'off' }", async () => {
    class OffBareSub extends BaseCrudController {}

    const warnings = await initApp(OffBareSub, { inheritance: 'off' })
    expect(warnings).toHaveLength(0)
  })
})
