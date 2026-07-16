// oxlint-disable max-classes-per-file, max-lines -- one isolated class hierarchy per matrix cell
// oxlint-disable no-useless-constructor -- re-declared pass-through constructors ARE the fixture (own design:paramtypes emission)
import { describe, expect, it } from 'vitest'

import { Controller } from '../decorators/controller.decorator'
import { Inherit } from '../decorators/inherit.decorator'
import { Injectable } from '../decorators/injectable.decorator'
import { Moost } from '../moost'
import { createCaptureLogger } from '../tests/capture-logger.artifacts'
import { FakeGet, fakeRouteAdapter, registeredPaths } from '../tests/fake-route.artifacts'
import { getMoostInfact } from './infact'
import { getMoostMate } from './moost-metadata'

/**
 * Inheritance test matrix (IMPROVEMENTS.md §3) — documentation-as-tests.
 *
 * Each cell pins EXACTLY which metadata flows across `extends` for the current
 * inheritance model: controller prefix, injectable scope, constructor params
 * (count + types), and method routes. Route flow is asserted through a real
 * `Moost.init()` with a fake adapter (the register-controllers.spec.ts
 * pattern); pure metadata flow is asserted via `getMoostMate().read()`.
 *
 * NOT covered here: the "parent decorated in a bundled dependency" cell.
 * Two-copy scenarios (decorators ran against one copy of moost, reads against
 * another) are a module-identity problem, not an inheritance problem — they
 * are detected by the D3 duplicate-copy stamp (src/module-identity.ts).
 */

/** Boots a real Moost app with the fake adapter and a silent capture logger. */
async function boot(...controllers: (object | Function)[]) {
  const { logger, warnings } = createCaptureLogger()
  const app = new Moost({ logger })
  app.adapter(fakeRouteAdapter)
  app.registerControllers(...controllers)
  await app.init()
  return { app, warnings }
}

const mate = getMoostMate()

@Injectable()
class Dep {
  value = 42
}

/** Fully decorated parent: prefix + injectable + 2 routes + 1 ctor dep. */
@Controller('p')
class ParentCtrl {
  constructor(public dep: Dep) {}

  @FakeGet('one')
  one() {
    return 'one'
  }

  @FakeGet('two')
  two() {
    return 'two'
  }
}

describe('inheritance matrix: empty subclass', () => {
  it('cell 1 — no @Inherit(): NOTHING flows (no prefix, no injectable, no ctor params, 0 routes)', async () => {
    class EmptySub extends ParentCtrl {}

    // metadata: the subclass reads as fully undecorated
    expect(mate.read(EmptySub)).toBeUndefined()

    // routes: binds silently with zero routes — the route-drop trap
    const { app } = await boot(EmptySub)
    expect(registeredPaths(app, 'EmptySub')).toEqual([])
  })

  it('cell 2 — WITH @Inherit(): everything flows (prefix, injectable, ctor params, all routes)', async () => {
    @Inherit()
    class InheritSub extends ParentCtrl {}

    const meta = mate.read(InheritSub)
    expect(meta?.controller?.prefix).toBe('p')
    expect(meta?.injectable).toBe(true)
    expect(meta?.params?.length).toBe(1)
    expect(meta?.params?.[0]?.type).toBe(Dep)

    const { app } = await boot(InheritSub)
    expect(registeredPaths(app, 'InheritSub')).toEqual(['/p/one', '/p/two'])

    // DI end-to-end: the inherited constructor param resolves
    const instance = (await getMoostInfact().get(InheritSub)) as InheritSub
    expect(instance.dep).toBeInstanceOf(Dep)
    expect(instance.dep.value).toBe(42)
  })
})

describe('inheritance matrix: subclass with own constructor', () => {
  it('cell 3a — @Controller + own ctor, no @Inherit(): own prefix + own ctor params, parent routes DROP', async () => {
    @Controller('sub')
    class OwnCtorSub extends ParentCtrl {
      constructor(public dep2: Dep) {
        super(dep2)
      }
    }

    const meta = mate.read(OwnCtorSub)
    expect(meta?.controller?.prefix).toBe('sub')
    expect(meta?.injectable).toBe(true)
    // own design:paramtypes captured from the re-declared constructor
    expect(meta?.params?.length).toBe(1)
    expect(meta?.params?.[0]?.type).toBe(Dep)

    // DI works — but the parent's routes are NOT inherited (silent 404)
    const { app } = await boot(OwnCtorSub)
    expect(registeredPaths(app, 'OwnCtorSub')).toEqual([])
  })

  it('cell 3b — @Inherit() + own ctor: own ctor params WIN, parent prefix + routes flow', async () => {
    @Inherit()
    class OwnCtorInheritSub extends ParentCtrl {
      constructor(public dep2: Dep) {
        super(dep2)
      }
    }

    const meta = mate.read(OwnCtorInheritSub)
    expect(meta?.controller?.prefix).toBe('p')
    expect(meta?.injectable).toBe(true)
    // class-level merge is shallow with own keys winning — own params replace parent's
    expect(meta?.params?.length).toBe(1)
    expect(meta?.params?.[0]?.type).toBe(Dep)

    const { app } = await boot(OwnCtorInheritSub)
    expect(registeredPaths(app, 'OwnCtorInheritSub')).toEqual(['/p/one', '/p/two'])
  })

  it('cell 3c — decorated subclass WITHOUT own ctor, no @Inherit(): parent ctor params flow AUTOMATICALLY', async () => {
    // This cell refutes the belief "a subclass without its own constructor
    // emits no design:paramtypes → 'Class is not Injectable' at request time":
    // when the subclass carries ANY class decorator, the metadata read falls
    // back to the parent's constructor params — no @Inherit() required.
    // Only the ROUTES drop without @Inherit().
    @Controller('sub3c')
    class NoCtorDecoratedSub extends ParentCtrl {}

    const meta = mate.read(NoCtorDecoratedSub)
    expect(meta?.controller?.prefix).toBe('sub3c')
    expect(meta?.injectable).toBe(true)
    expect(meta?.params?.length).toBe(1)
    expect(meta?.params?.[0]?.type).toBe(Dep)

    const { app } = await boot(NoCtorDecoratedSub)
    expect(registeredPaths(app, 'NoCtorDecoratedSub')).toEqual([])

    // DI end-to-end: the fallback params resolve
    const instance = (await getMoostInfact().get(NoCtorDecoratedSub)) as NoCtorDecoratedSub
    expect(instance.dep).toBeInstanceOf(Dep)
  })

  it('cell 3d — decorated subclass with own EMPTY ctor: params are [] (deliberate), not inherited', () => {
    @Controller('sub3d')
    class EmptyCtorSub extends ParentCtrl {
      constructor() {
        super(new Dep())
      }
    }

    // an own zero-param constructor emits params: [] — the parent's params do
    // NOT leak in (the fallback only fills fully-absent params)
    expect(mate.read(EmptyCtorSub)?.params).toEqual([])
  })

  it('cell 3e — an undecorated INTERMEDIATE class breaks the automatic ctor-params fallback', () => {
    class GapParent extends ParentCtrl {}

    @Controller('gap')
    class GapChild extends GapParent {}

    // the fallback walks exactly one level: the undecorated GapParent reads as
    // undefined, so GapChild gets NO params even though ParentCtrl declares one
    const meta = mate.read(GapChild)
    expect(meta?.injectable).toBe(true)
    expect(meta?.params).toBeUndefined()
  })

  it('cell 3f — @Inherit() does NOT bridge an undecorated intermediate (one level at a time)', async () => {
    class BridgeGap extends ParentCtrl {}

    @Inherit()
    class BridgeChild extends BridgeGap {}

    // the inherit merge reads exactly one level up: the undecorated BridgeGap
    // reads as undefined, so NOTHING flows to BridgeChild despite its @Inherit()
    const meta = mate.read(BridgeChild)
    expect(meta?.inherit).toBe(true)
    expect(meta?.controller).toBeUndefined()
    expect(meta?.params).toBeUndefined()

    const { app, warnings } = await boot(BridgeChild)
    expect(registeredPaths(app, 'BridgeChild')).toEqual([])
    // the inheritance audit names the broken link instead of staying silent
    expect(warnings.join('\n')).toContain('BridgeGap carry no @Inherit()')
  })
})

describe('inheritance matrix: subclass adding its own routes', () => {
  it('cell 4a — own routes, no @Inherit(): only own routes register, parent routes DROP', async () => {
    @Controller('sub4a')
    class OwnRouteSub extends ParentCtrl {
      @FakeGet('mine')
      mine() {
        return 'mine'
      }
    }

    const { app } = await boot(OwnRouteSub)
    expect(registeredPaths(app, 'OwnRouteSub')).toEqual(['/sub4a/mine'])
  })

  it('cell 4b — own routes WITH @Inherit(): parent routes survive; a decorated override REPLACES its route', async () => {
    @Inherit()
    class OwnRouteInheritSub extends ParentCtrl {
      @FakeGet('mine')
      mine() {
        return 'mine'
      }

      // decorated override: parent meta merges under it, but array fields
      // (handlers) replace wholesale — 'changed' is served, 'two' is not
      @FakeGet('changed')
      override two() {
        return 'two-changed'
      }
    }

    const { app } = await boot(OwnRouteInheritSub)
    expect(registeredPaths(app, 'OwnRouteInheritSub')).toEqual(['/p/changed', '/p/mine', '/p/one'])
  })
})

describe('inheritance matrix: @Inherit(false) opt-out', () => {
  it('cell 5a — class-level @Inherit(false): no prefix/injectable/routes; ctor params still auto-flow', async () => {
    @Inherit(false)
    class OptOutSub extends ParentCtrl {}

    const meta = mate.read(OptOutSub)
    expect(meta?.controller).toBeUndefined()
    expect(meta?.injectable).toBeUndefined()
    expect(meta?.inherit).toBe(false)
    // the ctor-params fallback is independent of @Inherit — it fills whenever
    // the class carries own metadata and no own constructor
    expect(meta?.params?.length).toBe(1)
    expect(meta?.params?.[0]?.type).toBe(Dep)

    const { app } = await boot(OptOutSub)
    expect(registeredPaths(app, 'OptOutSub')).toEqual([])
  })

  it('cell 5b — method-level @Inherit(false) under class @Inherit(): full replacement for that method', async () => {
    @Inherit()
    class MethodOptOutSub extends ParentCtrl {
      @Inherit(false)
      @FakeGet('replaced')
      override two() {
        return 'replaced'
      }
    }

    const { app } = await boot(MethodOptOutSub)
    // 'one' inherited; 'two' fully replaced by the opted-out override's own route
    expect(registeredPaths(app, 'MethodOptOutSub')).toEqual(['/p/one', '/p/replaced'])
  })
})

describe('inheritance matrix: own @Controller prefix under @Inherit()', () => {
  it('cell 6 — @Controller("own-prefix") + @Inherit(): own prefix WINS, parent routes mount under it', async () => {
    @Controller('own-prefix')
    @Inherit()
    class OwnPrefixSub extends ParentCtrl {}

    const meta = mate.read(OwnPrefixSub)
    expect(meta?.controller?.prefix).toBe('own-prefix')
    expect(meta?.injectable).toBe(true)
    expect(meta?.params?.[0]?.type).toBe(Dep)

    const { app } = await boot(OwnPrefixSub)
    expect(registeredPaths(app, 'OwnPrefixSub')).toEqual(['/own-prefix/one', '/own-prefix/two'])
  })
})

describe('inheritance matrix: injectable scope', () => {
  @Injectable('FOR_EVENT')
  class ScopeParent {
    constructor(public dep: Dep) {}
  }

  it('cell 7a — @Inherit() subclass inherits the FOR_EVENT scope', () => {
    @Inherit()
    class ScopeSub extends ScopeParent {}

    const meta = mate.read(ScopeSub)
    expect(meta?.injectable).toBe('FOR_EVENT')
    expect(meta?.params?.[0]?.type).toBe(Dep)
  })

  it('cell 7b — without @Inherit() the scope does not flow (undecorated subclass reads undefined)', () => {
    class ScopeSubNoInherit extends ScopeParent {}

    expect(mate.read(ScopeSubNoInherit)).toBeUndefined()
  })
})
