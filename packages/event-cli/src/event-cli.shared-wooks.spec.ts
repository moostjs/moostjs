import { createCliApp, WooksCli } from '@wooksjs/event-cli'
import { clearGlobalWooks, Moost } from 'moost'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { MoostCli } from './event-cli'

/** An app with `adapter`, logging warnings into `warnings`. */
function createApp(adapter: MoostCli) {
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

const sharing = (w: string) => w.includes('A second Moost app binds "cli" handlers')

describe('MoostCli on a Wooks instance another app uses', () => {
  beforeEach(() => {
    clearGlobalWooks()
    // onInit runs the CLI against process.argv: keep it from running the test runner's args
    vi.spyOn(WooksCli.prototype, 'run').mockResolvedValue(undefined)
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('warns once when two apps share the global Wooks', async () => {
    const a = createApp(new MoostCli())
    const b = createApp(new MoostCli())
    await a.app.init()
    await b.app.init()
    expect(a.warnings.filter((w) => sharing(w))).toEqual([])
    expect(b.warnings.filter((w) => sharing(w))).toHaveLength(1)
  })

  it('does not warn when two apps share a WooksCli passed in on purpose', async () => {
    const shared = createCliApp()
    const a = createApp(new MoostCli({ wooksCli: shared }))
    const b = createApp(new MoostCli({ wooksCli: shared }))
    await a.app.init()
    await b.app.init()
    expect([...a.warnings, ...b.warnings].filter((w) => sharing(w))).toEqual([])
  })
})
