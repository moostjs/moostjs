// oxlint-disable max-classes-per-file -- one isolated controller per test case
import { mintWfToken, outletHttp } from '@wooksjs/event-wf'
import {
  clearGlobalWooks,
  Controller,
  getMoostInfact,
  Injectable,
  Moost,
  useControllerContext,
  useScopeId,
} from 'moost'
import { beforeEach, describe, expect, it } from 'vitest'

import { Step, Workflow, WorkflowSchema } from './decorators'
import { MoostWf } from './event-wf'
import { HandleStateStrategy, normalizeWfId, WfStateStoreMemory } from './index'

@Injectable('FOR_EVENT')
class StepScoped {
  readonly id = Math.random()
}

const seen: number[] = []
let lastScopeId = ''

@Controller()
class ScopedFlows {
  @Step('ask')
  async ask() {
    // a FOR_EVENT resolution registers the run's DI scope
    const scoped = await useControllerContext().instantiate(StepScoped)
    seen.push(scoped.id)
    return outletHttp({ field: 'answer' })
  }

  @Step('done')
  async done() {
    const scoped = await useControllerContext().instantiate(StepScoped)
    seen.push(scoped.id)
    lastScopeId = useScopeId()
  }

  @Workflow('scoped/ask')
  @WorkflowSchema(['ask'])
  askFlow() {}

  @Workflow('scoped/done')
  @WorkflowSchema(['done'])
  doneFlow() {}
}

function scopes() {
  return (getMoostInfact() as unknown as { scopes: Map<string, unknown> }).scopes
}

async function boot() {
  const wf = new MoostWf()
  const app = new Moost()
  app.adapter(wf)
  app.registerControllers(ScopedFlows)
  await app.init()
  return wf
}

beforeEach(() => {
  clearGlobalWooks()
  seen.length = 0
})

describe('MoostWf — run scope released whoever starts the run', () => {
  it('releases the scope of a run started through getWfApp().start()', async () => {
    const wf = await boot()
    const before = scopes().size
    const output = await wf.getWfApp().start('/scoped/done', {})
    expect(output.finished).toBe(true)
    expect(seen).toHaveLength(1)
    expect(scopes().size).toBe(before)
  })

  it('releases the scope of a run resumed through getWfApp().resume()', async () => {
    const wf = await boot()
    const paused = await wf.start('/scoped/ask', {})
    expect(paused.inputRequired).toBeDefined()
    const before = scopes().size
    await wf.getWfApp().resume(paused.state, { input: { answer: 1 } })
    expect(scopes().size).toBe(before)
  })

  it('releases the scope of a run minted by mintWfToken(getWfApp())', async () => {
    const wf = await boot()
    const before = scopes().size
    const { token } = await mintWfToken(wf.getWfApp(), {
      wfid: 'scoped/ask',
      state: new HandleStateStrategy({ store: new WfStateStoreMemory() }),
    })
    expect(token).toBeDefined()
    expect(seen).toHaveLength(1)
    expect(scopes().size).toBe(before)
  })
})

describe('MoostWf — the caller cleanup of a run', () => {
  it('runs before the run scope is released (FOR_EVENT resolution still works in it)', async () => {
    const wf = await boot()
    let scopeAlive: boolean | undefined
    await wf.start(
      '/scoped/done',
      {},
      {
        cleanup: () => {
          scopeAlive = seen.length === 1 && [...scopes().keys()].some((id) => id === lastScopeId)
        },
      },
    )
    expect(scopeAlive).toBe(true)
  })
})

describe('MoostWf — flow id resolution', () => {
  it('resolveSchemaId() resolves a caller spelling to the registered flow id', async () => {
    const wf = await boot()
    expect(await wf.resolveSchemaId('scoped/ask')).toBe('/scoped/ask')
    expect(await wf.resolveSchemaId('/scoped/ask')).toBe('/scoped/ask')
    expect(await wf.resolveSchemaId('missing')).toBeUndefined()
  })

  it('re-exports normalizeWfId', () => {
    expect(normalizeWfId('/scoped/ask')).toBe('scoped/ask')
  })
})

describe('MoostWf.mint()', () => {
  it('starts a flow headlessly and returns a token the trigger resumes', async () => {
    const wf = await boot()
    const store = new WfStateStoreMemory()
    const state = new HandleStateStrategy({ store })
    const before = scopes().size

    const { token, inputRequired } = await wf.mint({ wfid: 'scoped/ask', state })

    expect(token).toMatch(/\S/)
    expect(inputRequired).toBeDefined()
    expect(scopes().size).toBe(before) // the minting run's scope is released
  })
})
