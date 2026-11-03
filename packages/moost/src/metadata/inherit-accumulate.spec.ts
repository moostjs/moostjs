// oxlint-disable max-classes-per-file, max-lines -- one isolated class hierarchy per case
import { describe, expect, it } from 'vitest'

import { Controller, ImportController } from '../decorators/controller.decorator'
import type { TInterceptorDef } from '../decorators/intercept.decorator'
import { Intercept, TInterceptorPriority } from '../decorators/intercept.decorator'
import { defineBeforeInterceptor, defineInterceptor } from '../define'
import { Inherit } from '../decorators/inherit.decorator'
import { Pipe } from '../decorators/pipe.decorator'
import { Const } from '../decorators/resolve.decorator'
import { boot, FakeGet } from '../tests/fake-route.artifacts'
import { getMoostMate } from './moost-metadata'

/**
 * Under `@Inherit()`, list metadata that describes behaviour (interceptors,
 * pipes, auth transports, resolved props) ACCUMULATES
 * along `extends` — base entries first, then the subclass's own — instead of
 * the subclass's own list replacing the base's. The same entry (reference)
 * declared on both levels is kept once, at the inherited position.
 */

const mate = getMoostMate<{ authTransports?: object[] }, { authTransports?: object[] }>()

/** Mimics `@Authenticate(guard)` from @moostjs/event-http: interceptor + transports. */
function FakeAuthenticate(guard: TInterceptorDef, transports: object) {
  return mate.apply(
    mate.decorate(
      'interceptors',
      { handler: guard, priority: TInterceptorPriority.GUARD, name: 'AuthGuard' },
      true,
    ),
    mate.decorate('authTransports', transports, true),
  )
}

function tracer(log: string[], name: string, priority = TInterceptorPriority.INTERCEPTOR) {
  return defineBeforeInterceptor(() => {
    log.push(name)
  }, priority)
}

describe('class-level interceptors accumulate along extends', () => {
  it('base @Intercept + subclass @Intercept: both run, base first within a priority', async () => {
    const log: string[] = []
    const A = tracer(log, 'A')
    const B = tracer(log, 'B')

    @Intercept(A)
    @Controller('base')
    class Base {
      @FakeGet('x')
      x() {
        log.push('handler')
        return 'ok'
      }
    }

    @Intercept(B)
    @Inherit()
    class Sub extends Base {}

    expect(mate.read(Sub)?.interceptors?.map((i) => i.handler)).toEqual([A, B])
    // the base's own metadata is untouched by the subclass read
    expect(mate.read(Base)?.interceptors?.map((i) => i.handler)).toEqual([A])

    const { call } = await boot(Sub)
    expect(await call('/base/x')).toBe('ok')
    expect(log).toEqual(['A', 'B', 'handler'])
  })

  it('base error-mapping interceptor survives a subclass auth guard', async () => {
    const log: string[] = []
    const errorMapper = defineInterceptor(
      {
        error: (error, reply) => {
          reply({ mapped: (error as Error).message })
        },
      },
      TInterceptorPriority.BEFORE_ALL,
    )
    const guard = tracer(log, 'guard', TInterceptorPriority.GUARD)

    @Intercept(errorMapper)
    @Controller('items')
    class BaseCrud {
      @FakeGet('write')
      write() {
        throw new Error('invalid payload')
      }
    }

    @FakeAuthenticate(guard, { bearer: {} })
    @Inherit()
    class ItemsCtrl extends BaseCrud {}

    const { call } = await boot(ItemsCtrl)
    expect(await call('/items/write')).toEqual({ mapped: 'invalid payload' })
    expect(log).toEqual(['guard'])
  })

  it('priority ordering still applies across levels', async () => {
    const log: string[] = []
    const late = tracer(log, 'base-late', TInterceptorPriority.AFTER_GUARD)
    const early = tracer(log, 'sub-guard', TInterceptorPriority.GUARD)

    @Intercept(late)
    @Controller('prio')
    class Base {
      @FakeGet('x')
      x() {
        return 'ok'
      }
    }

    @Intercept(early)
    @Inherit()
    class Sub extends Base {}

    const { call } = await boot(Sub)
    await call('/prio/x')
    expect(log).toEqual(['sub-guard', 'base-late'])
  })

  it('re-declaring an inherited interceptor runs it once, at its inherited position ([A, B] + A → [A, B])', async () => {
    const log: string[] = []
    const A = tracer(log, 'A')
    const B = tracer(log, 'B')

    @Intercept(A, TInterceptorPriority.INTERCEPTOR, 'A-base')
    @Intercept(B)
    @Controller('dup')
    class Base {
      @FakeGet('x')
      x() {
        return 'ok'
      }
    }

    @Intercept(A, TInterceptorPriority.INTERCEPTOR, 'A-sub')
    @Inherit()
    class Sub extends Base {}

    const list = mate.read(Sub)?.interceptors
    expect(list?.map((i) => i.handler)).toEqual([A, B])
    // the subclass's declaration is the one kept
    expect(list?.[0]?.name).toBe('A-sub')
    const { call } = await boot(Sub)
    await call('/dup/x')
    expect(log).toEqual(['A', 'B'])
  })

  it.each([
    ['without @Inherit()', undefined],
    ['with class-level @Inherit(false)', false],
  ])('%s nothing flows from the base', (_, inherit) => {
    const A = tracer([], 'A')
    const B = tracer([], 'B')

    @Intercept(A)
    class Base {}

    @Intercept(B)
    class Sub extends Base {}
    if (inherit === false) {
      Inherit(false)(Sub)
    }

    expect(mate.read(Sub)?.interceptors?.map((i) => i.handler)).toEqual([B])
  })

  it('a subclass with no own interceptors still inherits the base list as is', () => {
    const A = tracer([], 'A')

    @Intercept(A)
    class Base {}

    @Controller('own')
    @Inherit()
    class Sub extends Base {}

    expect(mate.read(Sub)?.interceptors?.map((i) => i.handler)).toEqual([A])
  })
})

describe('method-level interceptors accumulate into decorated overrides', () => {
  it('an override adding an interceptor keeps the parent method guard and route', async () => {
    const log: string[] = []
    const guard = tracer(log, 'guard', TInterceptorPriority.GUARD)
    const extra = tracer(log, 'extra')

    @Controller('m')
    class Base {
      @Intercept(guard)
      @FakeGet('x')
      x() {
        return 'base'
      }
    }

    @Inherit()
    class Sub extends Base {
      @Intercept(extra)
      override x() {
        return 'sub'
      }
    }

    const { call } = await boot(Sub)
    expect(await call('/m/x')).toBe('sub')
    expect(log).toEqual(['guard', 'extra'])
  })

  it('@Inherit(false) on the override is still a full replacement', () => {
    const guard = tracer([], 'guard')
    const extra = tracer([], 'extra')

    class Base {
      @Intercept(guard)
      @FakeGet('x')
      x() {}
    }

    @Inherit()
    class Sub extends Base {
      @Inherit(false)
      @Intercept(extra)
      override x() {}
    }

    const meta = mate.read(Sub, 'x')
    expect(meta?.interceptors?.map((i) => i.handler)).toEqual([extra])
    expect(meta?.handlers).toBeUndefined()
  })

  it('handler (route) lists still replace: an override re-routing keeps only its own route', () => {
    class Base {
      @FakeGet('old')
      x() {}
    }

    @Inherit()
    class Sub extends Base {
      @FakeGet('new')
      override x() {}
    }

    expect(mate.read(Sub, 'x')?.handlers).toEqual([{ type: 'FAKE', path: 'new' }])
  })
})

describe('other list metadata', () => {
  it('auth transports from base and subclass are both kept, shared ones once', () => {
    const g1 = tracer([], 'g1', TInterceptorPriority.GUARD)
    const g2 = tracer([], 'g2', TInterceptorPriority.GUARD)
    const bearer = { bearer: {} }
    const apiKey = { apiKey: { name: 'x', in: 'header' } }

    @FakeAuthenticate(g1, bearer)
    class Base {}

    @FakeAuthenticate(g2, apiKey)
    @Inherit()
    class Sub extends Base {}

    // re-declares the base guard: kept once
    @FakeAuthenticate(g1, bearer)
    @FakeAuthenticate(g2, apiKey)
    @Inherit()
    class SubRedeclared extends Base {}

    for (const ctor of [Sub, SubRedeclared]) {
      const meta = mate.read(ctor)
      expect(meta?.authTransports).toEqual([bearer, apiKey])
      expect(meta?.interceptors?.map((i) => i.handler)).toEqual([g1, g2])
    }
  })

  it('class-level pipes from base and subclass both run', async () => {
    const log: string[] = []
    const p1 = (value: unknown) => {
      log.push('p1')
      return value
    }
    const p2 = (value: unknown) => {
      log.push('p2')
      return value
    }

    @Pipe(p1)
    @Controller('pipes')
    class Base {
      @FakeGet('x')
      x(@Const('v') v: string) {
        return v
      }
    }

    @Pipe(p2)
    @Inherit()
    class Sub extends Base {}

    expect(mate.read(Sub)?.pipes?.map((p) => p.handler)).toEqual([p1, p2])
    const { call } = await boot(Sub)
    expect(await call('/pipes/x')).toBe('v')
    expect(log).toEqual(['p1', 'p2'])
  })

  it('resolved props declared on the base are still resolved when the subclass adds its own', async () => {
    @Controller('props')
    class Base {
      @Const('A')
      a!: string

      @FakeGet('x')
      x() {
        return `${this.a}|${(this as unknown as { b: string }).b}`
      }
    }

    @Inherit()
    class Sub extends Base {
      @Const('B')
      b!: string
    }

    expect(mate.read(Sub)?.properties).toEqual(['a', 'b'])
    const { call } = await boot(Sub)
    expect(await call('/props/x')).toBe('A|B')
  })

  it('@ImportController stays own-wins: a subclass import replaces the base imports', async () => {
    @Controller('one')
    class ChildOne {
      @FakeGet('x')
      x() {
        return 'one'
      }
    }

    @Controller('two')
    class ChildTwo {
      @FakeGet('x')
      x() {
        return 'two'
      }
    }

    @ImportController(ChildOne)
    @Controller('root')
    class Base {}

    @ImportController(ChildTwo)
    @Inherit()
    class Sub extends Base {}

    @Inherit()
    class SubNoOwnImports extends Base {}

    expect(mate.read(Sub)?.importController?.map((i) => i.typeResolver)).toEqual([ChildTwo])
    // with no own imports, the base's flow as before
    expect(mate.read(SubNoOwnImports)?.importController?.map((i) => i.typeResolver)).toEqual([
      ChildOne,
    ])
    const { call } = await boot(Sub)
    expect(() => call('/root/one/x')).toThrow('no handler for /root/one/x')
    expect(await call('/root/two/x')).toBe('two')
  })
})

describe('accumulation edge cases', () => {
  it('a factory called on each level yields two entries and runs twice', async () => {
    const log: string[] = []
    const makeTracer = () => tracer(log, 'factory')

    @Intercept(makeTracer())
    @Controller('factory')
    class Base {
      @FakeGet('x')
      x() {
        return 'ok'
      }
    }

    @Intercept(makeTracer())
    @Inherit()
    class Sub extends Base {}

    expect(mate.read(Sub)?.interceptors).toHaveLength(2)
    const { call } = await boot(Sub)
    await call('/factory/x')
    expect(log).toEqual(['factory', 'factory'])
  })

  it('re-reads after a cache invalidation stay stable and never touch own metadata', () => {
    const A = tracer([], 'A')
    const B = tracer([], 'B')
    const mA = tracer([], 'mA')
    const mB = tracer([], 'mB')

    @Intercept(A)
    class Base {
      @Intercept(mA)
      @FakeGet('x')
      x() {}
    }

    @Intercept(B)
    @Inherit()
    class Sub extends Base {
      @Intercept(mB)
      override x() {}
    }

    const instance = new Sub()
    const own = Reflect as unknown as {
      getOwnMetadata(key: string, target: object, prop?: string): { interceptors?: unknown[] }
    }
    for (let round = 0; round < 3; round++) {
      expect(mate.read(Sub)?.interceptors).toHaveLength(2)
      expect(mate.read(instance)?.interceptors).toHaveLength(2)
      expect(mate.read(Sub, 'x')?.interceptors).toHaveLength(2)
      expect(mate.read(instance, 'x')?.interceptors).toHaveLength(2)
      // decorating any other class invalidates Mate's read cache
      Intercept(tracer([], `other-${round}`))(class Other {})
    }
    expect(
      own
        .getOwnMetadata('moost', Sub)
        .interceptors?.map((i) => (i as { handler: unknown }).handler),
    ).toEqual([B])
    expect(
      own
        .getOwnMetadata('moost', Sub.prototype, 'x')
        .interceptors?.map((i) => (i as { handler: unknown }).handler),
    ).toEqual([mB])
    expect(own.getOwnMetadata('moost', Base).interceptors).toHaveLength(1)
  })

  it('three levels with a method override on each level: every class and method interceptor runs', async () => {
    const log: string[] = []
    const c1 = tracer(log, 'c1')
    const c2 = tracer(log, 'c2')
    const c3 = tracer(log, 'c3')
    const m1 = tracer(log, 'm1')
    const m2 = tracer(log, 'm2')
    const m3 = tracer(log, 'm3')

    @Intercept(c1)
    @Controller('levels')
    class L1 {
      @Intercept(m1)
      @FakeGet('x')
      x() {
        return 'L1'
      }
    }

    @Intercept(c2)
    @Inherit()
    class L2 extends L1 {
      @Intercept(m2)
      override x() {
        return 'L2'
      }
    }

    @Intercept(c3)
    @Inherit()
    class L3 extends L2 {
      @Intercept(m3)
      override x() {
        return 'L3'
      }
    }

    expect(mate.read(L3)?.interceptors?.map((i) => i.handler)).toEqual([c1, c2, c3])
    const { call } = await boot(L3)
    expect(await call('/levels/x')).toBe('L3')
    expect(log).toEqual(['c1', 'c2', 'c3', 'm1', 'm2', 'm3'])
  })

  it('method-level @Inherit(false) drops the parent method interceptors, not the class-level ones', async () => {
    const log: string[] = []
    const classGuard = tracer(log, 'class-guard')
    const methodGuard = tracer(log, 'method-guard')

    @Intercept(classGuard)
    @Controller('optout')
    class Base {
      @Intercept(methodGuard)
      @FakeGet('x')
      x() {
        return 'base'
      }
    }

    @Inherit()
    class Sub extends Base {
      @Inherit(false)
      @FakeGet('x')
      override x() {
        return 'sub'
      }
    }

    const { call } = await boot(Sub)
    expect(await call('/optout/x')).toBe('sub')
    expect(log).toEqual(['class-guard'])
  })
})
