// oxlint-disable max-classes-per-file -- each case declares its own DI chain
import {
  getInfactSingletonInstances,
  getMoostInfact,
  getMoostMate,
  Inject,
  Injectable,
  Moost,
  MoostDispose,
  Provide,
} from 'moost'
import { describe, expect, it } from 'vitest'

import {
  EJECT_ALL,
  mergeCleanup,
  moostRestartCleanup,
  readViteId,
  VITE_ID_KEY,
} from '../src/restart-cleanup'

/** Constructors of the instances currently alive in the (process-global) DI registry. */
const aliveConstructors = () => getInfactSingletonInstances().map((i) => i.constructor)

/**
 * The DI registry is process-global, so each case declares its own classes and
 * asserts only on those (and on its own closure-scoped log).
 */
describe('moostRestartCleanup — dependency ejection', () => {
  it('ejects and disposes the whole chain behind a Moost-dependent singleton', async () => {
    const log: string[] = []

    @Injectable()
    class Database {
      constructor(readonly app: Moost) {}

      @MoostDispose()
      close() {
        log.push('Database')
      }
    }

    @Injectable()
    class Repository {
      constructor(readonly db: Database) {}

      @MoostDispose()
      close() {
        log.push('Repository')
      }
    }

    @Injectable()
    class Worker {
      constructor(readonly repo: Repository) {}

      @MoostDispose()
      close() {
        log.push('Worker')
      }
    }

    @Injectable()
    class Standalone {
      @MoostDispose()
      close() {
        log.push('Standalone')
      }
    }

    const app = new Moost()
    app.registerControllers(Worker, Standalone)
    await app.init()
    expect(aliveConstructors()).toEqual(
      expect.arrayContaining([Database, Repository, Worker, Standalone]),
    )

    // A reload that touched no module of this chain: only the Moost dependency
    // (re-instantiated on every reload) makes Database stale — and with it
    // everything built on top of it, however deep.
    const ejected = await moostRestartCleanup(undefined, new Set())

    const alive = aliveConstructors()
    for (const stale of [Database, Repository, Worker]) {
      expect(ejected.some((i) => i instanceof stale)).toBe(true)
      expect(alive).not.toContain(stale)
    }
    // Before the fix Worker survived here, still holding the disposed Database.
    expect(log.toSorted()).toEqual(['Database', 'Repository', 'Worker'])
    // Nothing on the chain depends on it: kept, not disposed.
    expect(alive).toContain(Standalone)
    expect(ejected.some((i) => i instanceof Standalone)).toBe(false)
  })

  it('keeps an onEject-vetoed instance, and with it the consumers that depend on it', async () => {
    @Injectable()
    class Connection {
      constructor(readonly app: Moost) {}
    }

    @Injectable()
    class Pool {
      constructor(readonly conn: Connection) {}
    }

    @Injectable()
    class Consumer {
      constructor(readonly pool: Pool) {}
    }

    const app = new Moost()
    app.registerControllers(Consumer)
    await app.init()

    const ejected = await moostRestartCleanup((instance) => !(instance instanceof Pool), new Set())

    const alive = aliveConstructors()
    expect(ejected.some((i) => i instanceof Connection)).toBe(true)
    expect(alive).not.toContain(Connection)
    // The veto keeps Pool in the registry, so Consumer's dependency is present.
    expect(alive).toEqual(expect.arrayContaining([Pool, Consumer]))
  })
})

describe('moostRestartCleanup — provide factories', () => {
  it('re-runs a class-level @Provide factory for a controller rebuilt after a reload', async () => {
    // A late-binding factory, like a table resolved from the "current" DB space.
    let currentSpace = 'boot-1'

    @Provide('CURRENT_SPACE', () => currentSpace)
    @Injectable()
    class ReportsController {
      constructor(
        readonly app: Moost,
        @Inject('CURRENT_SPACE') readonly space: string,
      ) {}
    }

    const current = () =>
      getInfactSingletonInstances().find(
        (i): i is ReportsController => i instanceof ReportsController,
      )

    const first = new Moost()
    first.registerControllers(ReportsController)
    await first.init()
    expect(current()?.space).toBe('boot-1')

    // The reload swaps the space, then ejects the Moost-dependent controller.
    currentSpace = 'boot-2'
    await moostRestartCleanup(undefined, new Set())
    const second = new Moost()
    second.registerControllers(ReportsController)
    await second.init()

    // Same class object (its module was not edited), new instance — and the
    // factory ran again: up to @prostojs/infact 0.5.0 the first boot's value
    // was cached on the class's provide entry and survived every reload.
    expect(current()?.space).toBe('boot-2')
  })
})

describe('moostRestartCleanup — module eject and full reboot', () => {
  /** One evaluation of a module declaring an `@Injectable()` class: a NEW class per call. */
  function evaluateModule(viteId: string, log: string[]) {
    @(getMoostMate().decorate(VITE_ID_KEY, viteId))
    @Injectable()
    class Service {
      @MoostDispose()
      close() {
        log.push(`close:${viteId}`)
      }
    }
    return Service
  }

  it('ejects, disposes and replaces the singleton of a changed module', async () => {
    const log: string[] = []
    const First = evaluateModule('/src/changed.ts', log)
    const first = await getMoostInfact().get(First)
    expect(readViteId(first)).toBe('/src/changed.ts')

    const ejected = await moostRestartCleanup(undefined, new Set(['/src/changed.ts']))
    expect(ejected).toContain(first)
    expect(log).toEqual(['close:/src/changed.ts'])

    const Second = evaluateModule('/src/changed.ts', log)
    const second = await getMoostInfact().get(Second)
    expect(second).toBeInstanceOf(Second)
    expect(second).not.toBe(first)
  })

  it('disposes every instance on a full reboot, regardless of onEject', async () => {
    const log: string[] = []
    const Kept = evaluateModule('/src/untouched.ts', log)
    const kept = await getMoostInfact().get(Kept)

    // a server (re)start: no module ids, the whole registry goes
    const ejected = await moostRestartCleanup(() => false)
    expect(ejected).toContain(kept)
    expect(log).toEqual(['close:/src/untouched.ts'])
    expect(getInfactSingletonInstances()).toEqual([])
  })

  it('lets a queued full reboot win over module-scoped cleanups', () => {
    // the hot-update fallback (entry not in the graph → invalidateAll) queues EJECT_ALL
    expect(mergeCleanup(null, new Set(['/a.ts']))).toEqual(new Set(['/a.ts']))
    expect(mergeCleanup(new Set(['/a.ts']), new Set(['/b.ts']))).toEqual(
      new Set(['/a.ts', '/b.ts']),
    )
    expect(mergeCleanup(new Set(['/a.ts']), EJECT_ALL)).toBe(EJECT_ALL)
    expect(mergeCleanup(EJECT_ALL, new Set(['/b.ts']))).toBe(EJECT_ALL)
  })
})
