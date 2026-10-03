import { createEventContext, current, key, run } from '@wooksjs/event-core'
import { describe, expect, it } from 'vitest'

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
