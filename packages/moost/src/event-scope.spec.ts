import { createEventContext, current, key, run } from '@wooksjs/event-core'
import { describe, expect, it, vi } from 'vitest'

import { defineMoostEventHandler } from './adapter-utils'
import { setControllerContext, useControllerContext } from './composables'
import { Injectable } from './decorators'
import {
  forkEventContext,
  registerEventScope,
  useScopeId,
  withControllerContext,
} from './event-scope'
import { getMoostInfact } from './metadata/infact'

const testLogger = { info() {}, warn() {}, error() {}, debug() {} }

@Injectable('FOR_EVENT')
class EventPrincipal {
  readonly id = Math.random()
}

class ViewController {}
class SourceController {
  check() {
    return useControllerContext().getController()
  }
}

function scopes() {
  return (getMoostInfact() as unknown as { scopes: Map<string, unknown> }).scopes
}

/** Runs `fn` like a moost handler: the event's own DI scope registered for its duration. */
async function inMoostEvent<R>(fn: () => Promise<R>): Promise<R> {
  return createEventContext({ logger: testLogger }, async () => {
    const release = registerEventScope(useScopeId())
    try {
      return await fn()
    } finally {
      release()
    }
  })
}

const resolvePrincipal = () =>
  useControllerContext().instantiate(EventPrincipal) as Promise<EventPrincipal>

describe('forkEventContext', () => {
  it('reads through to the parent, writes stay in the child (copy-on-write)', () => {
    const k = key<string>('fork.test')
    createEventContext({ logger: testLogger }, () => {
      const parent = current()
      parent.set(k, 'parent')
      const child = forkEventContext()
      expect(child.get(k)).toBe('parent')
      child.set(k, 'child')
      expect(child.get(k)).toBe('child')
      expect(parent.get(k)).toBe('parent')
    })
  })

  it('isolated slots (keys, cached slots, defineWook composables) are never read through', () => {
    const k = key<string>('fork.isolated')
    const wookLike = { _slot: key<string>('fork.wook') }
    createEventContext({ logger: testLogger }, () => {
      const parent = current()
      parent.set(k, 'parent')
      parent.set(wookLike._slot, 'parent')
      const child = forkEventContext({ isolate: [k, wookLike] })
      expect(child.has(k)).toBe(false)
      expect(child.has(wookLike._slot)).toBe(false)
    })
  })

  it('a fork owns its scope id (not the parent one)', () => {
    createEventContext({ logger: testLogger }, () => {
      const child = forkEventContext()
      expect(useScopeId(child)).not.toBe(useScopeId())
    })
  })
})

describe('withControllerContext', () => {
  it('sets the controller context in the child only', async () => {
    const view = new ViewController()
    const source = new SourceController()
    await inMoostEvent(async () => {
      setControllerContext(view, '' as never, '/view')
      const seen = withControllerContext(source, 'check', () => source.check())
      expect(seen).toBe(source)
      expect(useControllerContext().getController()).toBe(view)
    })
  })

  it('shares the parent DI scope by default: FOR_EVENT deps resolve and are the parent event instances (H1)', async () => {
    const source = new SourceController()
    await inMoostEvent(async () => {
      setControllerContext(new ViewController(), '' as never, '/view')
      const parentPrincipal = await resolvePrincipal()

      // a plain fork owns an unregistered scope → FOR_EVENT resolution fails
      const plain = forkEventContext()
      await expect(
        run(plain, () => {
          setControllerContext(source, 'check', '')
          return resolvePrincipal()
        }),
      ).rejects.toThrow(/isn't registered/)

      const shared = await withControllerContext(source, 'check', () => resolvePrincipal())
      expect(shared).toBe(parentPrincipal)
    })
  })

  it('shareScope: false — own scope, registered while fn runs, released when it settles', async () => {
    const source = new SourceController()
    await inMoostEvent(async () => {
      setControllerContext(new ViewController(), '' as never, '/view')
      const parentPrincipal = await resolvePrincipal()
      let childScope = ''
      const own = await withControllerContext(
        source,
        'check',
        async () => {
          childScope = useScopeId()
          expect(scopes().has(childScope)).toBe(true)
          return resolvePrincipal()
        },
        { shareScope: false },
      )
      expect(own).not.toBe(parentPrincipal)
      expect(childScope).not.toBe(useScopeId())
      expect(scopes().has(childScope)).toBe(false)
      expect(scopes().has(useScopeId())).toBe(true)
    })
  })

  it('shareScope: false releases the scope when fn throws', async () => {
    await inMoostEvent(async () => {
      let childScope = ''
      await expect(
        withControllerContext(
          new SourceController(),
          'check',
          async () => {
            childScope = useScopeId()
            throw new Error('boom')
          },
          { shareScope: false },
        ),
      ).rejects.toThrow('boom')
      expect(scopes().has(childScope)).toBe(false)
    })
  })

  it('a shared-scope child never unregisters the parent scope', async () => {
    await inMoostEvent(async () => {
      await withControllerContext(new SourceController(), 'check', async () => resolvePrincipal())
      expect(scopes().has(useScopeId())).toBe(true)
    })
  })
})

describe('event scope held by a handler lifecycle (registered on demand)', () => {
  class Handlers {
    plain() {
      return useScopeId()
    }

    async twice() {
      const a = await resolvePrincipal()
      const registered = scopes().has(useScopeId())
      const b = await resolvePrincipal()
      return { same: a === b, registered, scopeId: useScopeId(), ctx: current() }
    }
  }
  const controller = new Handlers()

  function handlerFor(method: keyof Handlers, opts?: { manualUnscope?: boolean }) {
    return defineMoostEventHandler({
      loggerTitle: 'test',
      targetPath: `/${method}`,
      handlerType: 'TEST',
      getIterceptorHandler: () => undefined,
      getControllerInstance: () => controller,
      controllerMethod: method,
      ...opts,
    })
  }

  it('an event that resolves no FOR_EVENT class never registers its scope', () => {
    const registerSpy = vi.spyOn(getMoostInfact(), 'registerScope')
    const unregisterSpy = vi.spyOn(getMoostInfact(), 'unregisterScope')
    try {
      const before = scopes().size
      const scopeId = createEventContext({ logger: testLogger }, handlerFor('plain')) as string
      expect(typeof scopeId).toBe('string')
      expect(registerSpy).not.toHaveBeenCalled()
      expect(unregisterSpy).not.toHaveBeenCalled()
      expect(scopes().size).toBe(before)
    } finally {
      vi.restoreAllMocks()
    }
  })

  it('registers the scope on the first FOR_EVENT resolution, shares it, drops it on release', async () => {
    const before = scopes().size
    const result = (await createEventContext({ logger: testLogger }, handlerFor('twice'))) as {
      same: boolean
      registered: boolean
      scopeId: string
      ctx: ReturnType<typeof current>
    }
    expect(result.same).toBe(true)
    expect(result.registered).toBe(true)
    expect(scopes().has(result.scopeId)).toBe(false)
    expect(scopes().size).toBe(before)
    // a late resolution in the released event fails exactly as before: the scope is gone
    await expect(run(result.ctx, () => resolvePrincipal())).rejects.toThrow(/isn't registered/)
  })

  it('manualUnscope: a FOR_EVENT resolution after the handler settled still works until the adapter unscopes', async () => {
    let adapterUnscope!: () => void
    const handler = defineMoostEventHandler({
      loggerTitle: 'test',
      targetPath: '/plain',
      handlerType: 'TEST',
      manualUnscope: true,
      hooks: { init: ({ unscope }) => void (adapterUnscope = unscope) },
      getIterceptorHandler: () => undefined,
      getControllerInstance: () => controller,
      controllerMethod: 'plain',
    })
    await createEventContext({ logger: testLogger }, async () => {
      const ctx = current()
      handler()
      // the handler settled; the adapter still holds the scope (e.g. a streamed response)
      const late = await run(ctx, () => resolvePrincipal())
      expect(scopes().has(useScopeId())).toBe(true)
      expect(await run(ctx, () => resolvePrincipal())).toBe(late)
      adapterUnscope()
      expect(scopes().has(useScopeId())).toBe(false)
      await expect(run(ctx, () => resolvePrincipal())).rejects.toThrow(/isn't registered/)
    })
  })

  it('a shared-scope child of a running handler resolves the handler event instances', async () => {
    const source = new SourceController()
    const handler = defineMoostEventHandler({
      loggerTitle: 'test',
      targetPath: '/shared',
      handlerType: 'TEST',
      getIterceptorHandler: () => undefined,
      getControllerInstance: () => controller,
      callControllerMethod: async () => {
        // the child resolves first: it registers the parent event's scope
        const fromChild = await withControllerContext(source, 'check', () => resolvePrincipal())
        return fromChild === (await resolvePrincipal())
      },
    })
    expect(await createEventContext({ logger: testLogger }, handler)).toBe(true)
  })

  it("registerEventScope of the running event's scope: its release ends the scope for the lifecycle too", async () => {
    const handler = defineMoostEventHandler({
      loggerTitle: 'test',
      targetPath: '/manual',
      handlerType: 'TEST',
      getIterceptorHandler: () => undefined,
      getControllerInstance: () => controller,
      callControllerMethod: async () => {
        const release = registerEventScope(useScopeId())
        await resolvePrincipal()
        release()
        // as with an eager registration: the dropped scope is not brought back
        return resolvePrincipal().then(
          () => 'resolved',
          (error: Error) => error.message,
        )
      },
    })
    expect(await createEventContext({ logger: testLogger }, handler)).toMatch(/isn't registered/)
  })

  describe('direct registerScope / unregisterScope of the event scope on the DI container', () => {
    // a workflow-style adapter: manualUnscope, no hooks — the adapter hold is never released;
    // the run's cleanup unregisters the scope directly
    const manualHandler = (callControllerMethod: () => unknown) =>
      defineMoostEventHandler({
        loggerTitle: 'test',
        targetPath: '/wf',
        handlerType: 'TEST',
        manualUnscope: true,
        getIterceptorHandler: () => undefined,
        getControllerInstance: () => controller,
        callControllerMethod,
      })

    it('a direct unregister before any FOR_EVENT resolution ends the scope (no re-register, no leak)', async () => {
      const before = scopes().size
      const late = await createEventContext({ logger: testLogger }, async () => {
        await manualHandler(() => 'step')()
        getMoostInfact().unregisterScope(useScopeId()) // the run's cleanup
        // background work of the finished run resolving a FOR_EVENT class afterwards
        return resolvePrincipal().then(
          () => 'resolved',
          (error: Error) => error.message,
        )
      })
      expect(late).toMatch(/isn't registered/)
      expect(scopes().size).toBe(before)
    })

    it('a direct unregister after a FOR_EVENT resolution drops it', async () => {
      const before = scopes().size
      await createEventContext({ logger: testLogger }, async () => {
        await manualHandler(() => resolvePrincipal())()
        expect(scopes().has(useScopeId())).toBe(true)
        getMoostInfact().unregisterScope(useScopeId())
        expect(scopes().has(useScopeId())).toBe(false)
        await expect(resolvePrincipal()).rejects.toThrow(/isn't registered/)
      })
      expect(scopes().size).toBe(before)
    })

    it('a direct register before any FOR_EVENT resolution is dropped with the lifecycle', () => {
      const before = scopes().size
      const handler = defineMoostEventHandler({
        loggerTitle: 'test',
        targetPath: '/direct',
        handlerType: 'TEST',
        getIterceptorHandler: () => undefined,
        getControllerInstance: () => controller,
        callControllerMethod: () => {
          getMoostInfact().registerScope(useScopeId())
          return useScopeId()
        },
      })
      const scopeId = createEventContext({ logger: testLogger }, handler) as string
      expect(scopes().has(scopeId)).toBe(false)
      expect(scopes().size).toBe(before)
    })
  })
})
