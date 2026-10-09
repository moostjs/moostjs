import { MoostWf, Step, Workflow, WorkflowParam, WorkflowSchema } from '@moostjs/event-wf'
import { useRequest, useResponse } from '@wooksjs/event-http'
import { clearGlobalWooks, Controller, current, Moost } from 'moost'
import { beforeAll, describe, expect, it } from 'vitest'

import {
  BodyReadTimeoutMs,
  BodySizeLimit,
  Compress,
  CompressedBodySizeLimit,
  Get,
  SetCookie,
  SetHeader,
  SetStatus,
} from './decorators'
import { MoostHttp } from './event-http'

interface TFlowCtx {
  steps: string[]
}

let wf: MoostWf<TFlowCtx>

// HTTP routes and workflow steps in one controller: the class-level HTTP decorators apply to
// the HTTP events only.
@Controller()
@SetHeader('x-ctrl', 'yes')
@SetHeader('x-always', 'yes', { when: 'always' })
@SetStatus(201)
@SetCookie('ctrl-cookie', 'v')
@BodySizeLimit(1024)
@CompressedBodySizeLimit(512)
@BodyReadTimeoutMs(1000)
@Compress()
class MixedController {
  @Get('mixed')
  mixed() {
    return requestState()
  }

  @Get('mixed-runtime-off')
  runtimeOff() {
    // a runtime decision in the handler wins over the class-level @Compress()
    useResponse().setCompression(false)
    return requestState()
  }

  @Step('mark')
  mark(@WorkflowParam('context') ctx: TFlowCtx) {
    ctx.steps.push('mark')
  }

  @Step('fail')
  fail() {
    throw new Error('step failed')
  }

  @Workflow('mixed-flow')
  @WorkflowSchema<TFlowCtx>(['mark'])
  flow() {}

  @Workflow('mixed-fail-flow')
  @WorkflowSchema<TFlowCtx>(['fail'])
  failFlow() {}
}

@Controller()
class PlainController {
  @Get('starts-flow')
  async startsFlow() {
    const before = requestState()
    const output = await wf.start('/mixed-flow', { steps: [] }, { eventContext: current() })
    return { steps: output.state.context.steps, before, after: requestState() }
  }
}

function requestState() {
  const request = useRequest()
  return {
    maxInflated: request.getMaxInflated(),
    maxCompressed: request.getMaxCompressed(),
    readTimeoutMs: request.getReadTimeoutMs(),
    compressed: useResponse().compression !== false,
  }
}

let http: MoostHttp

beforeAll(async () => {
  clearGlobalWooks()
  const app = new Moost()
  http = new MoostHttp()
  wf = new MoostWf<TFlowCtx>()
  app.adapter(http)
  app.adapter(wf)
  app.registerControllers(MixedController, PlainController)
  await app.init()
})

async function get(path: string): Promise<Response> {
  const res = await http.request(path)
  if (!res) {
    throw new Error(`no route for ${path}`)
  }
  return res
}

describe('HTTP decorators on a controller that also handles workflow steps', () => {
  it('apply to the HTTP events of the controller', async () => {
    const res = await get('/mixed')
    expect(res.status).toBe(201)
    expect(res.headers.get('x-ctrl')).toBe('yes')
    expect(res.headers.get('x-always')).toBe('yes')
    expect(res.headers.get('set-cookie')).toMatch(/^ctrl-cookie=v/)
    expect(await res.json()).toEqual({
      maxInflated: 1024,
      maxCompressed: 512,
      readTimeoutMs: 1000,
      compressed: true,
    })
  })

  it('are skipped for a workflow run outside an HTTP request', async () => {
    const output = await wf.start('/mixed-flow', { steps: [] })
    expect(output.finished).toBe(true)
    expect(output.state.context.steps).toEqual(['mark'])
  })

  it('are skipped on the error path of a workflow step', async () => {
    await expect(wf.start('/mixed-fail-flow', { steps: [] })).rejects.toThrow('step failed')
  })

  it('let a runtime setCompression() in the handler win over @Compress', async () => {
    const res = await get('/mixed-runtime-off')
    expect(await res.json()).toMatchObject({ compressed: false })
  })

  it("leave the parent HTTP request alone for a workflow run as the request's child", async () => {
    const res = await get('/starts-flow')
    expect(res.status).toBe(200)
    expect(res.headers.get('x-ctrl')).toBeNull()
    expect(res.headers.get('x-always')).toBeNull()
    expect(res.headers.get('set-cookie')).toBeNull()
    const body = (await res.json()) as { steps: string[]; before: object; after: object }
    expect(body.steps).toEqual(['mark'])
    expect(body.after).toEqual(body.before)
    expect(body.before).toMatchObject({ compressed: false })
  })
})
