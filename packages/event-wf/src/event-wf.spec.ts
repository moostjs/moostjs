import type * as EventWfModule from '@wooksjs/event-wf'
import { outletHttp, swapStrategy, useWfStrategy, WooksWf } from '@wooksjs/event-wf'
import { Controller, Moost } from 'moost'
import { describe, expect, it, vi } from 'vitest'

import { Step, Workflow, WorkflowSchema } from './decorators'
import { MoostWf } from './event-wf'

// Coverage for WF_UPDATE.md adoption: verify that MoostWf forwards the new
// `strategy` and `eventContext` opts to the underlying WooksWf, and that
// strategy info round-trips through `output.inputRequired.stateStrategy`
// as the wooks outlet trigger expects on pause.

// Mock handleWfOutletRequest so we can capture the deps that MoostWf.handleOutlet
// builds, without standing up an HTTP trigger. All other exports are real.
vi.mock('@wooksjs/event-wf', async (orig) => {
  const real = await orig<typeof EventWfModule>()
  return {
    ...real,
    handleWfOutletRequest: vi.fn().mockResolvedValue(null),
  }
})

async function buildMoost(...controllers: Function[]): Promise<MoostWf> {
  const wf = new MoostWf()
  const app = new Moost()
  app.adapter(wf as never)
  app.registerControllers(...(controllers as never[]))
  await app.init()
  return wf
}

describe('MoostWf adapter — strategy + eventContext forwarding', () => {
  // Test #4 from WF_UPDATE.md — direct MoostWf.start with { strategy: { name } }
  it('start({ strategy }) surfaces the strategy name on pause output.inputRequired', async () => {
    const wfApp = new WooksWf()
    wfApp.step('await-input', { handler: () => outletHttp({ field: 'x' }) })
    wfApp.flow('flow-A', ['await-input'])

    const wf = new MoostWf(wfApp)

    const output = await wf.start('flow-A', {}, { strategy: { name: 'kv' } })

    expect(output.inputRequired).toBeDefined()
    expect((output.inputRequired as { stateStrategy?: string }).stateStrategy).toBe('kv')
  })

  // Test #3 from WF_UPDATE.md — swapStrategy() inside a @Step-decorated method
  it('swapStrategy() inside a @Step swaps the strategy name on the next pause', async () => {
    @Controller()
    class WfSwap {
      @Step('decide')
      decide() {
        swapStrategy('kv')
        return outletHttp({ field: 'decision' })
      }

      @Workflow('flow-swap')
      @WorkflowSchema(['decide'])
      flow() {}
    }

    const wf = await buildMoost(WfSwap)
    const output = await wf.start('/flow-swap', {}, { strategy: { name: 'mem' } })

    expect(output.inputRequired).toBeDefined()
    expect((output.inputRequired as { stateStrategy?: string }).stateStrategy).toBe('kv')
  })

  it('useWfStrategy().current() inside a @Step reflects the start-time strategy', async () => {
    let seenName: string | undefined
    @Controller()
    class WfInspect {
      @Step('inspect')
      inspect() {
        seenName = useWfStrategy().current()
        return outletHttp({})
      }

      @Workflow('flow-inspect')
      @WorkflowSchema(['inspect'])
      flow() {}
    }

    const wf = await buildMoost(WfInspect)
    await wf.start('/flow-inspect', {}, { strategy: { name: 'kv-1' } })
    expect(seenName).toBe('kv-1')
  })

  // Test #1 + #2 from WF_UPDATE.md — MoostWf.start/.resume must forward
  // input + eventContext + strategy through to wfApp. A dropped `opts` spread
  // on the Moost side would surface here directly. We pass `eventContext: undefined`
  // — the forwarding contract is the same whether or not a real parent ctx is set.
  it('start/resume forward { input, strategy, eventContext } to wfApp', async () => {
    const wfApp = new WooksWf()
    wfApp.step('s', { handler: () => outletHttp({}) })
    wfApp.flow('flow-fwd', ['s'])

    const startSpy = vi.spyOn(wfApp, 'start')
    const resumeSpy = vi.spyOn(wfApp, 'resume')

    const wf = new MoostWf(wfApp)

    await wf.start('flow-fwd', {}, {
      input: 'hi',
      strategy: { name: 'kv' },
    })
    expect(startSpy).toHaveBeenCalledWith(
      'flow-fwd',
      {},
      expect.objectContaining({ input: 'hi', strategy: { name: 'kv' } }),
    )

    await wf
      .resume(
        { schemaId: 'flow-fwd', context: {}, indexes: [0] },
        { input: 'bye', strategy: { name: 'mem' } },
      )
      // resume may fail because state is synthetic; we only care about the spy
      .catch(() => undefined)
    expect(resumeSpy).toHaveBeenCalledWith(
      { schemaId: 'flow-fwd', context: {}, indexes: [0] },
      expect.objectContaining({ input: 'bye', strategy: { name: 'mem' } }),
    )
  })

  // handleOutlet must build deps that forward `eventContext` and `strategy`
  // (alongside `input`) to MoostWf.start/.resume — otherwise the wooks trigger
  // throws "Workflow paused without 'stateStrategy' on inputRequired".
  it('handleOutlet wires deps that forward all opts to MoostWf.start/.resume', async () => {
    const wfMod = await import('@wooksjs/event-wf')
    const triggerMock = vi.mocked(wfMod.handleWfOutletRequest)
    triggerMock.mockReset()

    const wf = new MoostWf()
    const startSpy = vi
      .spyOn(wf, 'start')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockImplementation(async () => ({ inputRequired: {} }) as any)
    const resumeSpy = vi
      .spyOn(wf, 'resume')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockImplementation(async () => ({ finished: true }) as any)

    triggerMock.mockImplementation(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      async (_cfg: any, deps: any) => {
        const opts = { input: 'i', strategy: { name: 'kv' } }
        await deps.start('schemaX', { foo: 1 }, opts)
        await deps.resume({ schemaId: 'schemaX', context: { foo: 2 }, indexes: [0] }, opts)
        return null
      },
    )

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await wf.handleOutlet({ outlets: [], state: {} as any } as any)

    expect(startSpy).toHaveBeenCalledWith(
      'schemaX',
      { foo: 1 },
      expect.objectContaining({ input: 'i', strategy: { name: 'kv' } }),
    )
    expect(resumeSpy).toHaveBeenCalledWith(
      { schemaId: 'schemaX', context: { foo: 2 }, indexes: [0] },
      expect.objectContaining({ input: 'i', strategy: { name: 'kv' } }),
    )
  })
})
