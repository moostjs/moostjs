import {
  clearGlobalWooks,
  Controller,
  createEventContext,
  current,
  Moost,
  registerEventScope,
  setControllerContext,
  useControllerContext,
  useScopeId,
} from 'moost'
import { describe, expect, it } from 'vitest'

import { MoostWf, outletHttp, Step, Workflow, WorkflowSchema } from './index'

describe('a workflow run under a parent event (e.g. handleOutlet in an HTTP handler)', () => {
  it('leaves the parent event’s controller context alone', async () => {
    clearGlobalWooks()
    let inStep: string | undefined
    @Controller()
    class Steps {
      @Step('ask')
      ask() {
        inStep = useControllerContext().getMethod()
        return outletHttp({})
      }

      @Workflow('ask-flow')
      @WorkflowSchema(['ask'])
      flow() {}
    }
    const wf = new MoostWf()
    const app = new Moost()
    app.adapter(wf as never)
    app.registerControllers(Steps)
    await app.init()

    const httpController = { handler() {} }
    await createEventContext({ logger: console }, async () => {
      // stands in for the HTTP handler dispatch that calls wf.handleOutlet()
      const unscope = registerEventScope(useScopeId())
      setControllerContext(httpController, 'handler', '/wf', { prefix: '' })
      await wf.start('/ask-flow', {}, { eventContext: current() })
      // what an after-interceptor of the HTTP handler reads
      expect(useControllerContext().getController()).toBe(httpController)
      expect(useControllerContext().getMethod()).toBe('handler')
      expect(useControllerContext().getRoute()).toBe('/wf')
      unscope()
    })
    expect(inStep).toBe('ask')
  })
})
