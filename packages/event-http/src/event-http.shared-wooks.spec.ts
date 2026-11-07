// oxlint-disable max-classes-per-file -- one controller per app
import { createHttpApp, HttpError } from '@wooksjs/event-http'
import { clearGlobalWooks, Controller, Moost } from 'moost'
import { beforeEach, describe, expect, it } from 'vitest'

import { Get } from './decorators'
import { MoostHttp } from './event-http'

@Controller()
class LimitedController {
  @Get('limited')
  limited() {
    throw new HttpError(429, 'Too many requests')
  }
}

@Controller()
class OpenController {
  @Get('limited')
  limited() {
    return 'ok'
  }
}

/** An app on a new `MoostHttp` (the global Wooks, or `httpApp`), logging into `warnings`. */
function createApp(controller: Function, httpApp?: ReturnType<typeof createHttpApp>) {
  const warnings: string[] = []
  const noop = () => {}
  const logger = {
    warn: (...args: unknown[]) => void warnings.push(args.map(String).join(' ')),
    error: noop,
    log: noop,
    info: noop,
    debug: noop,
    trace: noop,
  }
  const app = new Moost({ logger })
  const http = new MoostHttp(httpApp)
  app.adapter(http)
  app.registerControllers(controller)
  return { app, http, warnings }
}

const sharing = (w: string) => w.includes('A second Moost app binds "http" handlers')

describe('MoostHttp on a Wooks instance another app uses', () => {
  beforeEach(() => {
    clearGlobalWooks()
  })

  it('warns once when two apps share the global Wooks (the first app’s error is swallowed)', async () => {
    const a = createApp(LimitedController)
    const b = createApp(OpenController)
    const c = createApp(OpenController)
    await a.app.init()
    await b.app.init()
    await c.app.init()
    expect(a.warnings.filter((w) => sharing(w))).toEqual([])
    expect(b.warnings.filter((w) => sharing(w))).toHaveLength(1)
    expect(b.warnings[0]).toContain('clearGlobalWooks()')
    expect(c.warnings.filter((w) => sharing(w))).toEqual([]) // once per Wooks instance
    // what the warning is about: the first app's 429 is swallowed, the second app answers
    const res = await b.http.request('/limited')
    expect(res?.status).toBe(200)
    expect(await res?.text()).toBe('ok')
  })

  it('does not warn when each app gets its own Wooks (clearGlobalWooks() between them)', async () => {
    const a = createApp(LimitedController)
    await a.app.init()
    clearGlobalWooks()
    const b = createApp(OpenController)
    await b.app.init()
    expect([...a.warnings, ...b.warnings].filter((w) => sharing(w))).toEqual([])
    const fromA = await a.http.request('/limited')
    const fromB = await b.http.request('/limited')
    expect(fromA?.status).toBe(429)
    expect(fromB?.status).toBe(200)
  })

  it('does not warn when two apps share a WooksHttp passed in on purpose', async () => {
    const shared = createHttpApp()
    const a = createApp(LimitedController, shared)
    const b = createApp(OpenController, shared)
    await a.app.init()
    await b.app.init()
    expect([...a.warnings, ...b.warnings].filter((w) => sharing(w))).toEqual([])
  })

  it('warns when a created app lands on the global Wooks a passed-in app already uses', async () => {
    const a = createApp(LimitedController, createHttpApp()) // passed in, but on the global Wooks
    const b = createApp(OpenController)
    await a.app.init()
    await b.app.init()
    expect(b.warnings.filter((w) => sharing(w))).toHaveLength(1)
  })

  it('does not warn when the same app is initialised again', async () => {
    const a = createApp(LimitedController)
    await a.app.init()
    await a.app.init()
    expect(a.warnings.filter((w) => sharing(w))).toEqual([])
  })
})
