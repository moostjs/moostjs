import { createWfApp } from '@wooksjs/event-wf'
import { clearGlobalWooks, Moost } from 'moost'
import { beforeEach, describe, expect, it } from 'vitest'

import { MoostWf } from './event-wf'

/** An app with `adapter`, logging warnings into `warnings`. */
function createApp(adapter: MoostWf) {
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
  app.adapter(adapter)
  return { app, warnings }
}

const sharing = (w: string) => w.includes('A second Moost app binds "workflow" handlers')

describe('MoostWf on a Wooks instance another app uses', () => {
  beforeEach(() => {
    clearGlobalWooks()
  })

  it('warns once when two apps share the global Wooks', async () => {
    const a = createApp(new MoostWf())
    const b = createApp(new MoostWf())
    await a.app.init()
    await b.app.init()
    expect(a.warnings.filter((w) => sharing(w))).toEqual([])
    expect(b.warnings.filter((w) => sharing(w))).toHaveLength(1)
  })

  it('does not warn when two apps share a WooksWf passed in on purpose', async () => {
    const shared = createWfApp()
    const a = createApp(new MoostWf(shared))
    const b = createApp(new MoostWf(shared))
    await a.app.init()
    await b.app.init()
    expect([...a.warnings, ...b.warnings].filter((w) => sharing(w))).toEqual([])
  })
})
