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
      'UsersController does not bind the route handler(s) BaseCrudController.list(), ' +
        'BaseCrudController.read() of its ancestor(s) and has no @Inherit()',
    )
    expect(joined).toContain('Add @Inherit() or re-declare the routes')
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
      'RouteGapController has @Inherit() but does not bind the inherited route handler(s) ' +
        'BaseCrudController.list(), BaseCrudController.read()',
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

  it('is silent when the subclass re-declares every route', async () => {
    @Controller('own')
    class OwnRoutesController extends BaseCrudController {
      constructor(dep: Dep) {
        super(dep)
      }

      @FakeGet('list')
      override list() {
        return []
      }

      @FakeGet('read')
      override read() {
        return {}
      }
    }

    const warnings = await initApp(OwnRoutesController)
    expect(warnings).toHaveLength(0)
  })

  it('warns when the subclass re-declares only some routes, naming the dropped ones', async () => {
    @Controller('partial')
    class PartialController extends BaseCrudController {
      constructor(dep: Dep) {
        super(dep)
      }

      @FakeGet('list')
      override list() {
        return []
      }
    }

    const warnings = await initApp(PartialController)
    const joined = warnings.join('\n')
    expect(joined).toContain(
      'PartialController does not bind the route handler(s) BaseCrudController.read() ' +
        'of its ancestor(s) and has no @Inherit()',
    )
    expect(joined).not.toContain('BaseCrudController.list()')
  })

  it('is silent with @Inherit() and one re-declared route (the others flow)', async () => {
    @Inherit()
    class InheritOneController extends BaseCrudController {
      @FakeGet('list-v2')
      override list() {
        return []
      }
    }

    const warnings = await initApp(InheritOneController)
    expect(warnings).toHaveLength(0)
  })

  it('warns with @Inherit() and one re-declared route when a broken chain drops the others', async () => {
    class PartialGapMiddle extends BaseCrudController {}

    @Inherit()
    class PartialGapController extends PartialGapMiddle {
      @FakeGet('list')
      override list() {
        return []
      }
    }

    const warnings = await initApp(PartialGapController)
    const joined = warnings.join('\n')
    expect(joined).toContain(
      'PartialGapController has @Inherit() but does not bind the inherited route handler(s) ' +
        'BaseCrudController.read()',
    )
    expect(joined).toContain('the intermediate class(es) PartialGapMiddle carry no @Inherit()')
    expect(joined).not.toContain('BaseCrudController.list()')
  })

  it('is silent when an override drops its route on purpose with a member-level @Inherit(false)', async () => {
    @Controller('member-opt-out')
    class MemberOptOutController extends BaseCrudController {
      constructor(dep: Dep) {
        super(dep)
      }

      @FakeGet('list')
      override list() {
        return []
      }

      @Inherit(false)
      override read() {
        return {}
      }
    }

    @Inherit()
    class InheritMemberOptOutController extends BaseCrudController {
      @Inherit(false)
      override read() {
        return {}
      }
    }

    expect(await initApp(MemberOptOutController)).toHaveLength(0)
    expect(await initApp(InheritMemberOptOutController)).toHaveLength(0)
  })

  it('is silent when a middle class replaces its parent routes with a class-level @Inherit(false)', async () => {
    @Inherit(false)
    @Controller('replaced')
    class ReplacingMiddle extends BaseCrudController {
      constructor(dep: Dep) {
        super(dep)
      }

      @FakeGet('only')
      only() {
        return 'only'
      }
    }

    @Inherit()
    class ReplacedController extends ReplacingMiddle {}

    const warnings = await initApp(ReplacedController)
    expect(warnings).toHaveLength(0)
  })

  it('is silent for a route a middle class drops with a member-level @Inherit(false)', async () => {
    @Inherit()
    class DroppingMiddle extends BaseCrudController {
      @Inherit(false)
      override read() {
        return {}
      }
    }

    @Inherit()
    class AfterDropController extends DroppingMiddle {}

    const warnings = await initApp(AfterDropController)
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
  it('warns for a subclass with NO own metadata at all over a decorated ancestor', async () => {
    class BareSubController extends BaseCrudController {}

    const warnings = await initApp(BareSubController)
    const joined = warnings.join('\n')
    // both traps fire: routes dropped AND ctor params unresolvable
    expect(joined).toContain(
      'BareSubController does not bind the route handler(s) BaseCrudController.list(), ' +
        'BaseCrudController.read()',
    )
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
    // the one warning is about the parent's dropped routes, none about constructor params
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toContain(
      'ZeroCtorController does not bind the route handler(s) BaseCrudController.list(), ' +
        'BaseCrudController.read()',
    )
  })

  it("is silenced by diagnostics: { inheritance: 'off' }", async () => {
    class OffBareSub extends BaseCrudController {}

    const warnings = await initApp(OffBareSub, { inheritance: 'off' })
    expect(warnings).toHaveLength(0)
  })
})
