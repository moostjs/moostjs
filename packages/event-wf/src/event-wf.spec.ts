import type * as EventWfModule from '@wooksjs/event-wf'
import {
  outletHttp,
  StepRetriableError,
  swapStrategy,
  useWfStrategy,
  WooksWf,
} from '@wooksjs/event-wf'
import { clearGlobalWooks, Controller, Moost } from 'moost'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { Step, StepTTL, Workflow, WorkflowParam, WorkflowSchema } from './decorators'
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

beforeEach(() => {
  clearGlobalWooks()
})

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

    await wf.start(
      'flow-fwd',
      {},
      {
        input: 'hi',
        strategy: { name: 'kv' },
      },
    )
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

// Coverage for the @StepTTL wrapper installed by bindHandler (WF_STEP branch).
// A step can re-pause two ways: by RETURNING an inputRequired outlet, or by
// THROWING a StepRetriableError (the idiomatic "re-render with validation
// errors, keep the same wfs token" path). The wrapper must stamp the step's
// TTL onto `output.expires` on BOTH paths — the engine forwards `expires`
// through the error path identically to the return path.
describe('MoostWf adapter — @WorkflowParam resolvers', () => {
  it("@WorkflowParam('indexes') injects the indexes array, not the accessor function", async () => {
    let seenIndexes: unknown
    @Controller()
    class WfIndexes {
      @Step('capture')
      capture(@WorkflowParam('indexes') indexes: number[]) {
        seenIndexes = indexes
        return outletHttp({})
      }

      @Workflow('flow-indexes')
      @WorkflowSchema(['capture'])
      flow() {}
    }

    const wf = await buildMoost(WfIndexes)
    const paused = await wf.start('/flow-indexes', {})

    // fresh start: indexes is undefined (not the accessor function)
    expect(typeof seenIndexes).not.toBe('function')
    expect(seenIndexes).toBeUndefined()

    expect(paused.state).toBeDefined()
    await wf.resume(paused.state as { schemaId: string; context: object; indexes: number[] }, {})

    // on resume the step re-runs with its position in the schema
    expect(typeof seenIndexes).not.toBe('function')
    expect(Array.isArray(seenIndexes)).toBe(true)
    expect(seenIndexes).toEqual([0])
  })
})

describe('MoostWf adapter — @StepTTL on re-pause', () => {
  const HOUR = 60 * 60 * 1000
  const MONTH = 30 * 24 * HOUR

  // NOTE: WF steps register into the global wooks router (createWfApp/new MoostWf
  // with no explicit Wooks instance => getGlobalWooks()), and duplicate step ids
  // there silently first-win rather than throwing the way duplicate flow ids do.
  // The top-level `beforeEach(clearGlobalWooks)` resets that router between tests
  // so each test is hermetic — without it, a step id reused across tests would
  // silently run the first-registered handler.

  it('stamps @StepTTL when a step re-pauses by RETURNING an inputRequired outlet', async () => {
    @Controller()
    class WfReturn {
      @Step('ttl-return-step')
      @StepTTL(MONTH)
      awaitInput() {
        return outletHttp({ field: 'x' })
      }

      @Workflow('flow-ttl-return')
      @WorkflowSchema(['ttl-return-step'])
      flow() {}
    }

    const wf = await buildMoost(WfReturn)
    const before = Date.now()
    const output = await wf.start('/flow-ttl-return', {}, { strategy: { name: 'kv' } })
    const after = Date.now()

    expect(output.expires).toBeGreaterThanOrEqual(before + MONTH)
    expect(output.expires).toBeLessThanOrEqual(after + MONTH)
  })

  it('stamps @StepTTL when a step re-pauses by THROWING a StepRetriableError', async () => {
    @Controller()
    class WfThrow {
      @Step('ttl-throw-step')
      @StepTTL(MONTH)
      validate() {
        // idiomatic re-pause: throw to re-render with errors, no expires set
        throw new StepRetriableError(new Error('invalid input'))
      }

      @Workflow('flow-ttl-throw')
      @WorkflowSchema(['ttl-throw-step'])
      flow() {}
    }

    const wf = await buildMoost(WfThrow)
    const before = Date.now()
    const output = await wf.start('/flow-ttl-throw', {}, {})
    const after = Date.now()

    expect(output.expires).toBeGreaterThanOrEqual(before + MONTH)
    expect(output.expires).toBeLessThanOrEqual(after + MONTH)
  })

  it('does not clobber an expires already set on the thrown StepRetriableError', async () => {
    const explicit = 1_999_999_999_999

    @Controller()
    class WfThrowExplicit {
      @Step('ttl-explicit-step')
      @StepTTL(MONTH)
      validate() {
        // 4th ctor arg is `expires` — an explicitly stamped error TTL must win
        throw new StepRetriableError(new Error('invalid input'), undefined, undefined, explicit)
      }

      @Workflow('flow-ttl-explicit')
      @WorkflowSchema(['ttl-explicit-step'])
      flow() {}
    }

    const wf = await buildMoost(WfThrowExplicit)
    const output = await wf.start('/flow-ttl-explicit', {}, {})

    expect(output.expires).toBe(explicit)
  })
})
