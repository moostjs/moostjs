// oxlint-disable max-classes-per-file -- one isolated controller per test case
import { describe, expect, it } from 'vitest'

import { Controller } from './decorators/controller.decorator'
import { Moost } from './moost'
import { FakeGet, fakeRouteAdapter, registeredPaths } from './tests/fake-route.artifacts'

function computedPrefix(app: Moost, name: string): string | undefined {
  return app.getControllersOverview().find((c) => c.type.name === name)?.computedPrefix
}

describe('registerControllers prefix forms', () => {
  it('tuple form REPLACES the controller own @Controller prefix (pinned behavior)', async () => {
    @Controller('users')
    class TupleUsers {
      @FakeGet('list')
      list() {}
    }

    const app = new Moost()
    app.adapter(fakeRouteAdapter)
    app.registerControllers(['api/db/users', TupleUsers])
    await app.init()

    // the decorator prefix 'users' is dropped — NOT prepended (/api/db/users/users/list)
    expect(computedPrefix(app, 'TupleUsers')).toBe('/api/db/users')
    expect(registeredPaths(app, 'TupleUsers')).toEqual(['/api/db/users/list'])
  })

  it('object form prepends by default: globalPrefix + prefix + @Controller prefix compose', async () => {
    @Controller('users')
    class GroupUsers {
      @FakeGet('list')
      list() {}
    }

    const app = new Moost({ globalPrefix: 'v1' })
    app.adapter(fakeRouteAdapter)
    app.registerControllers({ prefix: 'api', controllers: [GroupUsers] })
    await app.init()

    expect(computedPrefix(app, 'GroupUsers')).toBe('v1/api/users')
    expect(registeredPaths(app, 'GroupUsers')).toEqual(['/v1/api/users/list'])
  })

  it('object form with mode "replace" matches the tuple behavior', async () => {
    @Controller('users')
    class ReplaceUsers {
      @FakeGet('list')
      list() {}
    }

    @Controller('users')
    class TupleTwin {
      @FakeGet('list')
      list() {}
    }

    const app = new Moost()
    app.adapter(fakeRouteAdapter)
    app.registerControllers(
      { prefix: 'api/db/users', mode: 'replace', controllers: [ReplaceUsers] },
      ['api/db/users', TupleTwin],
    )
    await app.init()

    expect(computedPrefix(app, 'ReplaceUsers')).toBe(computedPrefix(app, 'TupleTwin'))
    expect(registeredPaths(app, 'ReplaceUsers')).toEqual(['/api/db/users/list'])
    expect(registeredPaths(app, 'TupleTwin')).toEqual(['/api/db/users/list'])
  })

  it('object form works for a controller without a @Controller prefix', async () => {
    @Controller()
    class BarePrefix {
      @FakeGet('ping')
      ping() {}
    }

    const app = new Moost()
    app.adapter(fakeRouteAdapter)
    app.registerControllers({ prefix: 'api', controllers: [BarePrefix] })
    await app.init()

    expect(registeredPaths(app, 'BarePrefix')).toEqual(['/api/ping'])
  })

  it('plain classes and instances bind unchanged alongside the object form', async () => {
    @Controller('a')
    class MixA {
      @FakeGet('x')
      x() {}
    }

    @Controller('b')
    class MixB {
      @FakeGet('y')
      y() {}
    }

    @Controller('c')
    class MixC {
      @FakeGet('z')
      z() {}
    }

    const app = new Moost()
    app.adapter(fakeRouteAdapter)
    app.registerControllers(MixA, { prefix: 'api', controllers: [MixB] }, new MixC())
    await app.init()

    expect(registeredPaths(app, 'MixA')).toEqual(['/a/x'])
    expect(registeredPaths(app, 'MixB')).toEqual(['/api/b/y'])
    expect(registeredPaths(app, 'MixC')).toEqual(['/c/z'])
  })

  it('globalPrefix composes with both modes', async () => {
    @Controller('users')
    class GlobalPrepend {
      @FakeGet('list')
      list() {}
    }

    @Controller('users')
    class GlobalReplace {
      @FakeGet('list')
      list() {}
    }

    const app = new Moost({ globalPrefix: 'api' })
    app.adapter(fakeRouteAdapter)
    app.registerControllers(
      { prefix: 'v2', controllers: [GlobalPrepend] },
      { prefix: 'legacy/users', mode: 'replace', controllers: [GlobalReplace] },
    )
    await app.init()

    // prepend: globalPrefix + '/' + prefix + '/' + own prefix
    expect(registeredPaths(app, 'GlobalPrepend')).toEqual(['/api/v2/users/list'])
    // replace: own prefix replaced by `prefix`, but still mounted under globalPrefix
    expect(registeredPaths(app, 'GlobalReplace')).toEqual(['/api/legacy/users/list'])
  })
})
