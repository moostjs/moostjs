// oxlint-disable max-classes-per-file -- one isolated fixture per test case
import { createProvideRegistry, createReplaceRegistry, getClassKey } from '@prostojs/infact'
import { describe, expect, it } from 'vitest'

import { Controller, ImportController, Inject, Injectable, Replace } from './decorators'
import { Moost } from './moost'
import { createCaptureLogger } from './tests/capture-logger.artifacts'

function makeApp() {
  return new Moost({ logger: createCaptureLogger().logger })
}

describe('replace registry introspection', () => {
  it('getReplacement / hasReplacement / getReplaceRegistry work before and after init', async () => {
    class A {}
    class B {}
    class C {}
    class D {}
    const app = makeApp()
    app.setReplaceRegistry(createReplaceRegistry([A, B]))

    expect(app.getReplacement(A)).toBe(B)
    expect(app.hasReplacement(A)).toBe(true)
    expect(app.getReplacement(C)).toBeUndefined()
    expect(app.hasReplacement(C)).toBe(false)

    const snapshot = app.getReplaceRegistry()
    expect(snapshot[getClassKey(A)]).toBe(B)
    expect(Object.isFrozen(snapshot)).toBe(true)

    await app.init()
    expect(app.getReplacement(A)).toBe(B)

    app.setReplaceRegistry(createReplaceRegistry([C, D]))
    expect(app.getReplacement(C)).toBe(D)
    expect(snapshot[getClassKey(C)]).toBeUndefined()
  })

  it('override: false skips existing keys, adds new ones, and is order-independent', () => {
    class A {}
    class B {}
    class Default {}
    class X {}
    class Y {}

    const defaults = createReplaceRegistry([A, Default], [X, Y])
    const own = createReplaceRegistry([A, B])

    const defaultFirst = makeApp()
    defaultFirst.setReplaceRegistry(defaults, { override: false })
    defaultFirst.setReplaceRegistry(own)

    const defaultSecond = makeApp()
    defaultSecond.setReplaceRegistry(own)
    defaultSecond.setReplaceRegistry(defaults, { override: false })

    for (const app of [defaultFirst, defaultSecond]) {
      expect(app.getReplacement(A)).toBe(B)
      expect(app.getReplacement(X)).toBe(Y)
    }
  })

  it('override: false does not override a subclass @Replace', () => {
    class A {}
    class FromDecorator {}
    class Default {}

    @Replace(A, FromDecorator)
    class MyApp extends Moost {}

    const app = new MyApp({ logger: createCaptureLogger().logger })
    expect(app.getReplacement(A)).toBe(FromDecorator)
    app.setReplaceRegistry(createReplaceRegistry([A, Default]), { override: false })
    expect(app.getReplacement(A)).toBe(FromDecorator)
  })

  it('app-subclass @Replace reaches a grandchild @ImportController', async () => {
    @Injectable()
    class Dep {
      name = 'original'
    }
    @Injectable()
    class MockDep extends Dep {
      override name = 'mock'
    }

    let received: Dep | undefined
    @Controller('leaf')
    class Leaf {
      constructor(dep: Dep) {
        received = dep
      }
    }

    @Controller('mid')
    @ImportController(Leaf)
    class Mid {}

    @Replace(Dep, MockDep)
    class MyApp extends Moost {}

    const app = new MyApp({ logger: createCaptureLogger().logger })
    app.registerControllers(Mid)
    await app.init()

    expect(received).toBeInstanceOf(MockDep)
  })

  it('setProvideRegistry override: false keeps the existing factory, in either order', async () => {
    const resolve = async (defaultFirst: boolean) => {
      let received: string | undefined
      let other: string | undefined
      @Controller('p')
      class Ctrl {
        constructor(@Inject('TOKEN') t: string, @Inject('OTHER') o: string) {
          received = t
          other = o
        }
      }
      const app = makeApp()
      const own = () => app.setProvideRegistry(createProvideRegistry(['TOKEN', () => 'own']))
      const defaults = () =>
        app.setProvideRegistry(
          createProvideRegistry(['TOKEN', () => 'default'], ['OTHER', () => 'other']),
          { override: false },
        )
      if (defaultFirst) {
        defaults()
        own()
      } else {
        own()
        defaults()
      }
      app.registerControllers(Ctrl)
      await app.init()
      return [received, other]
    }
    expect(await resolve(true)).toEqual(['own', 'other'])
    expect(await resolve(false)).toEqual(['own', 'other'])
  })

  it("override: false does not skip a token named like an Object.prototype member ('toString')", async () => {
    let received: string | undefined
    @Controller('ts')
    class Ctrl {
      constructor(@Inject('toString') t: string) {
        received = t
      }
    }
    const app = makeApp()
    app.setProvideRegistry(createProvideRegistry(['toString', () => 'registered']), {
      override: false,
    })
    app.registerControllers(Ctrl)
    await app.init()
    expect(received).toBe('registered')
  })

  it('infact follows getReplacement(A) one hop only', async () => {
    @Injectable()
    class A {}
    @Injectable()
    class B {}
    @Injectable()
    class C {}

    let received: A | undefined
    @Controller('x')
    class Ctrl {
      constructor(a: A) {
        received = a
      }
    }

    const app = makeApp()
    app.setReplaceRegistry(createReplaceRegistry([A, B], [B, C]))
    app.registerControllers(Ctrl)
    await app.init()

    expect(app.getReplacement(A)).toBe(B)
    expect(received).toBeInstanceOf(B)
    expect(received).not.toBeInstanceOf(C)
  })
})
