import type { TConsoleBase } from '@prostojs/logger'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { Moost } from './moost'

type TSignalListener = () => void

/**
 * `process` stand-in: signals are never really sent and `exit`/`kill` never
 * really fire — the captured listeners are invoked by hand instead.
 */
function stubProcess() {
  const listeners = new Map<string, TSignalListener[]>()
  const on = vi.spyOn(process, 'on').mockImplementation(((
    event: string,
    listener: TSignalListener,
  ) => {
    listeners.set(event, [...(listeners.get(event) ?? []), listener])
    return process
  }) as typeof process.on)
  const off = vi.spyOn(process, 'off').mockImplementation(((
    event: string,
    listener: TSignalListener,
  ) => {
    listeners.set(
      event,
      (listeners.get(event) ?? []).filter((l) => l !== listener),
    )
    return process
  }) as typeof process.off)
  const kill = vi.spyOn(process, 'kill').mockImplementation((() => true) as typeof process.kill)
  const exit = vi
    .spyOn(process, 'exit')
    .mockImplementation((() => undefined) as unknown as typeof process.exit)
  const fire = (signal: string) => {
    for (const listener of listeners.get(signal) ?? []) {
      listener()
    }
  }
  const count = (signal: string) => (listeners.get(signal) ?? []).length
  return { listeners, on, off, kill, exit, fire, count }
}

function fakeLogger() {
  const warn = vi.fn()
  const logger: TConsoleBase = {
    error: vi.fn(),
    warn,
    log: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
  }
  return { logger, warn }
}

/** A Moost whose `dispose()` is stubbed — nothing real is torn down here. */
function appWith(dispose: () => Promise<void>, logger?: TConsoleBase) {
  const app = new Moost({ logger: logger || fakeLogger().logger })
  const spy = vi.spyOn(app, 'dispose').mockImplementation(dispose)
  return { app, spy }
}

describe('Moost.disposeOnSignals', () => {
  let env: ReturnType<typeof stubProcess>
  let unregister: (() => void) | undefined

  beforeEach(() => {
    env = stubProcess()
  })

  afterEach(() => {
    // Drops the global record so the next test starts from a clean process.
    unregister?.()
    unregister = undefined
    vi.restoreAllMocks()
  })

  it('registers one listener per signal and returns an unregister fn', () => {
    const { app } = appWith(() => Promise.resolve())

    unregister = app.disposeOnSignals()

    expect(env.on).toHaveBeenCalledTimes(2)
    expect(env.count('SIGTERM')).toBe(1)
    expect(env.count('SIGINT')).toBe(1)
    expect(typeof unregister).toBe('function')
  })

  it('re-targets the existing listeners at the newest app instead of stacking', async () => {
    const first = appWith(() => Promise.resolve())
    const second = appWith(() => Promise.resolve())

    unregister = first.app.disposeOnSignals()
    second.app.disposeOnSignals()

    // Nothing new registered — the second call reuses the same two listeners.
    expect(env.on).toHaveBeenCalledTimes(2)
    expect(env.count('SIGTERM')).toBe(1)

    env.fire('SIGTERM')

    await vi.waitFor(() => expect(second.spy).toHaveBeenCalledTimes(1))
    expect(first.spy).not.toHaveBeenCalled()
  })

  it('unions signals across calls without touching the registered ones', () => {
    const { app } = appWith(() => Promise.resolve())

    unregister = app.disposeOnSignals(['SIGTERM'])
    app.disposeOnSignals(['SIGTERM', 'SIGHUP'])

    expect(env.off).not.toHaveBeenCalled()
    expect(env.count('SIGTERM')).toBe(1)
    expect(env.count('SIGHUP')).toBe(1)
  })

  it('removes the listeners and re-raises the signal once disposal finished', async () => {
    const { app, spy } = appWith(() => Promise.resolve())

    unregister = app.disposeOnSignals(['SIGTERM'])
    env.fire('SIGTERM')

    await vi.waitFor(() => expect(env.kill).toHaveBeenCalledWith(process.pid, 'SIGTERM'))
    expect(spy).toHaveBeenCalledTimes(1)
    expect(env.count('SIGTERM')).toBe(0)
    expect(env.exit).not.toHaveBeenCalled()
  })

  it('removes every listener BEFORE dispose() settles, and re-raises only after', async () => {
    let release: () => void = () => undefined
    const { app, spy } = appWith(
      () =>
        new Promise<void>((resolve) => {
          release = resolve
        }),
    )

    unregister = app.disposeOnSignals(['SIGTERM', 'SIGINT'])
    env.fire('SIGTERM')

    // dispose() is still pending, yet nothing is hooked any more: a second signal
    // now gets Node's default handling instead of reaching a listener.
    expect(spy).toHaveBeenCalledTimes(1)
    expect(env.off).toHaveBeenCalledTimes(2)
    expect(env.count('SIGTERM')).toBe(0)
    expect(env.count('SIGINT')).toBe(0)
    expect(env.kill).not.toHaveBeenCalled()
    expect(env.exit).not.toHaveBeenCalled()

    release()
    await vi.waitFor(() => expect(env.kill).toHaveBeenCalledWith(process.pid, 'SIGTERM'))
  })

  it('logs a failing dispose and re-raises the signal all the same', async () => {
    const { logger, warn } = fakeLogger()
    const { app } = appWith(() => Promise.reject(new Error('boom')), logger)

    unregister = app.disposeOnSignals(['SIGINT'])
    env.fire('SIGINT')

    await vi.waitFor(() => expect(env.kill).toHaveBeenCalledWith(process.pid, 'SIGINT'))
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('dispose on SIGINT failed: boom'))
  })

  it('unregisters on demand and re-registers on a later call', () => {
    const { app } = appWith(() => Promise.resolve())

    const stop = app.disposeOnSignals(['SIGTERM'])
    stop()

    expect(env.off).toHaveBeenCalledTimes(1)
    expect(env.count('SIGTERM')).toBe(0)
    // A stale unregister fn is a no-op, it never removes a newer registration.
    stop()
    expect(env.off).toHaveBeenCalledTimes(1)

    unregister = app.disposeOnSignals(['SIGTERM'])

    expect(env.on).toHaveBeenCalledTimes(2)
    expect(env.count('SIGTERM')).toBe(1)
  })
})
