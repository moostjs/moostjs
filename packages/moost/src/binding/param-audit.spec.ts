// oxlint-disable max-classes-per-file, max-lines -- one isolated controller per test case
import { createProvideRegistry } from '@prostojs/infact'
import { describe, expect, it } from 'vitest'

import {
  Circular,
  Controller,
  Inject,
  Injectable,
  MoostInit,
  Optional,
  Param,
  Resolve,
} from '../decorators'
import { Moost } from '../moost'
import { createCaptureLogger } from '../tests/capture-logger.artifacts'
import { FakeGet } from '../tests/fake-route.artifacts'
import { resolveParamAuditMode } from './param-audit'

/**
 * Fixture notes:
 * - An interface-typed param genuinely emits `Object` in `design:paramtypes`
 *   (the `import type` footgun shares this exact emit).
 * - A param annotated `undefined` genuinely emits `undefined` — the same emit
 *   a circular import produces — deterministically within a single file
 *   (a real two-file import cycle is resolved lazily by the vitest runner and
 *   does not reproduce the broken emit reliably).
 */
interface TDeps {
  a: string
}

describe('resolveParamAuditMode', () => {
  it('honors an explicit setting and falls back by NODE_ENV', () => {
    const env = process.env.NODE_ENV
    try {
      expect(resolveParamAuditMode('off')).toBe('off')
      expect(resolveParamAuditMode('warn')).toBe('warn')
      process.env.NODE_ENV = 'production'
      expect(resolveParamAuditMode()).toBe('warn')
      process.env.NODE_ENV = 'development'
      expect(resolveParamAuditMode()).toBe('error')
    } finally {
      process.env.NODE_ENV = env
    }
  })
})

describe('D1 param audit — constructor params', () => {
  it('rejects init() naming class, param index, and the import-type cause (SINGLETON)', async () => {
    @Controller()
    class UsersController {
      constructor(private deps: TDeps) {}
    }

    const { logger, warnings } = createCaptureLogger()
    const app = new Moost({ logger })
    app.registerControllers(UsersController)

    await expect(app.init()).rejects.toThrow(
      /UsersController\.constructor parameter #0 has type Object.*'import type'/,
    )
    // every finding is also logged before the aggregate error is thrown
    expect(warnings.join('\n')).toContain('UsersController.constructor parameter #0')
  })

  it('rejects init() for a FOR_EVENT controller at bind time, before any event', async () => {
    @Injectable('FOR_EVENT')
    class PerEventController {
      constructor(private deps: TDeps) {}
    }

    const { logger } = createCaptureLogger()
    const app = new Moost({ logger })
    app.registerControllers(PerEventController)

    await expect(app.init()).rejects.toThrow(/PerEventController\.constructor parameter #0/)
  })

  it('aggregates all fatal findings into a single init() error', async () => {
    @Controller()
    class AggregateA {
      constructor(private deps: TDeps) {}
    }

    @Controller()
    class AggregateB {
      constructor(private dep: undefined) {}
    }

    const { logger } = createCaptureLogger()
    const app = new Moost({ logger })
    app.registerControllers(AggregateA, AggregateB)

    const message = await app.init().then(
      () => 'init() unexpectedly resolved',
      (error: Error) => error.message,
    )
    expect(message).toContain('2 findings')
    expect(message).toContain('AggregateA.constructor parameter #0')
    expect(message).toContain('AggregateB.constructor parameter #0')
  })

  it('names the circular-import cause and @Circular fix for an undefined emitted type', async () => {
    @Controller()
    class BrokenCircularController {
      constructor(private dep: undefined) {}
    }

    const { logger } = createCaptureLogger()
    const app = new Moost({ logger })
    app.registerControllers(BrokenCircularController)

    await expect(app.init()).rejects.toThrow(
      /BrokenCircularController\.constructor parameter #0 has no emitted design type.*circular import.*@Circular/,
    )
  })

  it("downgrades to a warning with diagnostics: { paramTypes: 'warn' }", async () => {
    @Injectable('FOR_EVENT')
    class WarnModeController {
      constructor(private deps: TDeps) {}
    }

    const { logger, warnings } = createCaptureLogger()
    const app = new Moost({ logger, diagnostics: { paramTypes: 'warn' } })
    app.registerControllers(WarnModeController)

    await app.init()
    expect(warnings.join('\n')).toMatch(
      /WarnModeController\.constructor parameter #0 has type Object/,
    )
  })

  it('warn mode keeps the original SINGLETON instantiation failure but logs the context first', async () => {
    @Controller()
    class WarnSingletonController {
      constructor(private deps: TDeps) {}
    }

    const { logger, warnings } = createCaptureLogger()
    const app = new Moost({ logger, diagnostics: { paramTypes: 'warn' } })
    app.registerControllers(WarnSingletonController)

    // the pre-existing infact error still rejects init() (no behavior change in prod)...
    await expect(app.init()).rejects.toThrow(/not Injectable/)
    // ...but the named, positioned warning was emitted alongside it
    expect(warnings.join('\n')).toContain('WarnSingletonController.constructor parameter #0')
  })

  it("skips the audit entirely with diagnostics: { paramTypes: 'off' }", async () => {
    @Injectable('FOR_EVENT')
    class OffModeController {
      constructor(private deps: TDeps) {}
    }

    const { logger, warnings } = createCaptureLogger()
    const app = new Moost({ logger, diagnostics: { paramTypes: 'off' } })
    app.registerControllers(OffModeController)

    await app.init()
    expect(warnings).toHaveLength(0)
  })

  it('optional constructor params are warn-only even at default dev severity', async () => {
    @Controller()
    class OptionalDepsController {
      constructor(@Optional() private deps?: TDeps) {}
    }

    const { logger, warnings } = createCaptureLogger()
    const app = new Moost({ logger })
    app.registerControllers(OptionalDepsController)

    await app.init() // silent-undefined injection is legal — never throws
    expect(warnings.join('\n')).toContain('OptionalDepsController.constructor parameter #0')
  })
})

describe('D1 param audit — explicit-resolution escape hatches', () => {
  it('does not flag @Inject(token) params', async () => {
    @Controller()
    class InjectTokenController {
      constructor(@Inject('MY_TOKEN') private deps: TDeps) {}
    }

    const { logger, warnings } = createCaptureLogger()
    const app = new Moost({ logger })
    app.setProvideRegistry(createProvideRegistry(['MY_TOKEN', () => ({ a: 'provided' })]))
    app.registerControllers(InjectTokenController)

    await app.init()
    expect(warnings).toHaveLength(0)
  })

  it('does not flag @Resolve() params', async () => {
    @Controller()
    class ResolveController {
      constructor(@Resolve(() => ({ a: 'resolved' })) private deps: TDeps) {}
    }

    const { logger, warnings } = createCaptureLogger()
    const app = new Moost({ logger })
    app.registerControllers(ResolveController)

    await app.init()
    expect(warnings).toHaveLength(0)
  })

  it('does not flag @Circular(() => X) params with an undefined emitted type', async () => {
    @Injectable()
    class CircularDep {}

    @Controller()
    class CircularController {
      constructor(@Circular(() => CircularDep) private dep: undefined) {}
    }

    const { logger, warnings } = createCaptureLogger()
    const app = new Moost({ logger })
    app.registerControllers(CircularController)

    await app.init()
    expect(warnings).toHaveLength(0)
  })

  it('does not flag class-typed (value import) params', async () => {
    @Injectable()
    class RealDep {
      value = 42
    }

    @Controller()
    class HappyController {
      constructor(private dep: RealDep) {}
    }

    const { logger, warnings } = createCaptureLogger()
    const app = new Moost({ logger })
    app.registerControllers(HappyController)

    await app.init()
    expect(warnings).toHaveLength(0)
  })
})

describe('D1 param audit — handler method params', () => {
  it('warns (never throws) for an undecorated interface-typed handler param', async () => {
    @Controller()
    class MethodController {
      @FakeGet('x')
      handler(@Param('id') id: string, body: TDeps) {
        return { id, body }
      }
    }

    const { logger, warnings } = createCaptureLogger()
    const app = new Moost({ logger })
    app.registerControllers(MethodController)

    await app.init() // method params never break boot
    const joined = warnings.join('\n')
    // decorated param #0 is silent, undecorated param #1 is flagged
    expect(joined).not.toContain('MethodController.handler parameter #0')
    expect(joined).toMatch(/MethodController\.handler parameter #1 has type Object/)
    expect(joined).toContain('undefined at event time')
  })

  it('audits @MoostInit method params (warn-only)', async () => {
    @Controller()
    class InitHookController {
      @MoostInit()
      setup(deps: TDeps) {
        return deps
      }
    }

    const { logger, warnings } = createCaptureLogger()
    const app = new Moost({ logger })
    app.registerControllers(InitHookController)

    await app.init()
    expect(warnings.join('\n')).toContain('InitHookController.setup parameter #0')
  })

  it("stays silent for method params when paramTypes is 'off'", async () => {
    @Controller()
    class OffMethodController {
      @FakeGet('y')
      handler(body: TDeps) {
        return body
      }
    }

    const { logger, warnings } = createCaptureLogger()
    const app = new Moost({ logger, diagnostics: { paramTypes: 'off' } })
    app.registerControllers(OffMethodController)

    await app.init()
    expect(warnings).toHaveLength(0)
  })
})
