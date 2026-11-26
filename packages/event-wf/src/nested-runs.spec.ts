import { clearGlobalWooks, Controller, current, Moost } from 'moost'
import { describe, expect, it } from 'vitest'

import { MoostWf, outletHttp, Step, Workflow, WorkflowParam, WorkflowSchema } from './index'

describe('a run started inside a @Step (wooks 0.8.6)', () => {
  it('resolves @WorkflowParam from its own run, not the enclosing one', async () => {
    clearGlobalWooks()
    const seen: Record<string, unknown> = {}
    const wf = new MoostWf()
    @Controller()
    class Nested {
      @Step('inner')
      inner(@WorkflowParam('context') ctx: { who: string }) {
        seen.inner = ctx.who
        return outletHttp({})
      }

      @Step('outer')
      async outer(@WorkflowParam('context') ctx: { who: string }) {
        await wf.start('/inner-flow', { who: 'inner' }, { eventContext: current() })
        seen.outer = ctx.who
        return outletHttp({})
      }

      @Workflow('inner-flow')
      @WorkflowSchema(['inner'])
      innerFlow() {}

      @Workflow('outer-flow')
      @WorkflowSchema(['outer'])
      outerFlow() {}
    }
    const app = new Moost()
    app.adapter(wf as never)
    app.registerControllers(Nested)
    await app.init()

    await wf.start('/outer-flow', { who: 'outer' })
    expect(seen).toEqual({ inner: 'inner', outer: 'outer' })
  })
})
