// oxlint-disable max-classes-per-file -- one isolated controller / interceptor per test case
// oxlint-disable require-await
import { createEventContext } from '@wooksjs/event-core'
import { describe, expect, it, vi } from 'vitest'

import { defineMoostEventHandler } from '../adapter-utils'
import { useInterceptOriginal } from '../composables'
import type { TInterceptorDef, TOvertakeFn } from '../decorators'
import {
  After,
  Controller,
  Intercept,
  Interceptor,
  OnError,
  Overtake,
  Response,
  TInterceptorPriority,
} from '../decorators'
import { InterceptorHandler } from '../interceptor-handler'
import { boot, FakeGet, testLogger } from './fake-route.artifacts'

/**
 * Runs `result` (a handler outcome: a value, a thrown error, or a promise) through the
 * after/error chain of `defs` — `defs[0]` is the outermost interceptor (registered first),
 * so its hooks run LAST.
 */
async function runChain(
  defs: TInterceptorDef[],
  result: () => unknown,
  logger: typeof testLogger = testLogger,
) {
  const handler = defineMoostEventHandler({
    loggerTitle: 'test',
    logErrors: logger !== testLogger,
    targetPath: '/chain',
    handlerType: 'TEST',
    getIterceptorHandler: () =>
      new InterceptorHandler(
        defs.map((def, i) => ({ handler: def, name: `I${i}`, spanName: `Interceptor:I${i}` })),
      ),
    getControllerInstance: () => ({ run: result }),
    controllerMethod: 'run' as never,
  })
  return await createEventContext({ logger }, handler)
}

describe('interceptor after/error chain', () => {
  it('each after hook sees the previous hook reply (current value), the original as 3rd arg', async () => {
    const seen: unknown[][] = []
    const outer: TInterceptorDef = {
      after: (response, _reply, original) => {
        seen.push(['outer', response, original])
      },
    }
    const inner: TInterceptorDef = {
      after: (response, reply, original) => {
        seen.push(['inner', response, original])
        reply({ wrapped: response })
      },
    }

    const result = await runChain([outer, inner], () => 'raw')

    expect(result).toEqual({ wrapped: 'raw' })
    expect(seen).toEqual([
      ['inner', 'raw', 'raw'],
      ['outer', { wrapped: 'raw' }, 'raw'],
    ])
  })

  it('an error hook sees the error a previous error hook replied with', async () => {
    const original = new Error('original')
    const translated = new Error('translated')
    const seen: unknown[][] = []
    const outer: TInterceptorDef = {
      error: (error, _reply, orig) => {
        seen.push([error, orig])
      },
    }
    const inner: TInterceptorDef = {
      error: (_error, reply) => {
        reply(translated)
      },
    }

    await expect(
      runChain([outer, inner], () => {
        throw original
      }),
    ).rejects.toBe(translated)
    expect(seen).toEqual([[translated, original]])
  })

  it('a recovering reply switches the rest of the chain to after hooks', async () => {
    const outerAfter = vi.fn()
    const outerError = vi.fn()
    const outer: TInterceptorDef = { after: outerAfter, error: outerError }
    const inner: TInterceptorDef = {
      error: (_error, reply) => {
        reply('recovered')
      },
    }

    const result = await runChain([outer, inner], () => {
      throw new Error('boom')
    })

    expect(result).toBe('recovered')
    expect(outerError).not.toHaveBeenCalled()
    expect(outerAfter).toHaveBeenCalledWith('recovered', expect.any(Function), expect.any(Error))
  })

  it('an error thrown by an after hook reaches the error hooks of outer interceptors (sync)', async () => {
    const afterError = new Error('after failed')
    const catchError = vi.fn((_error: Error, reply: (r: unknown) => void) => {
      reply({ handled: true })
    })
    const outer: TInterceptorDef = { error: catchError }
    const inner: TInterceptorDef = {
      after: () => {
        throw afterError
      },
    }

    const result = await runChain([outer, inner], () => 'ok')

    expect(catchError).toHaveBeenCalledWith(afterError, expect.any(Function), 'ok')
    expect(result).toEqual({ handled: true })
  })

  it('an error thrown by an async after hook reaches outer error hooks (async handler)', async () => {
    const afterError = new Error('async after failed')
    const catchError = vi.fn(async (_error: Error, reply: (r: unknown) => void) => {
      reply('caught')
    })
    const outer: TInterceptorDef = { error: catchError }
    const inner: TInterceptorDef = {
      after: async () => {
        throw afterError
      },
    }

    const result = await runChain([outer, inner], async () => 'ok')

    expect(catchError).toHaveBeenCalledWith(afterError, expect.any(Function), 'ok')
    expect(result).toBe('caught')
  })

  it('an after hook replying with an Error switches the chain to error mode', async () => {
    const refusal = new Error('refused')
    const catchError = vi.fn()
    const outer: TInterceptorDef = { after: vi.fn(), error: catchError }
    const inner: TInterceptorDef = {
      after: (_response, reply) => {
        reply(refusal)
      },
    }

    const result = await runChain([outer, inner], () => 'ok')

    expect(catchError).toHaveBeenCalledWith(refusal, expect.any(Function), 'ok')
    expect(outer.after).not.toHaveBeenCalled()
    expect(result).toBe(refusal)
  })

  it('a non-Error thrown by an after hook goes to the error hooks too', async () => {
    const catchError = vi.fn((_error: unknown, reply: (r: unknown) => void) => {
      reply('caught')
    })
    const outer: TInterceptorDef = { after: vi.fn(), error: catchError }
    const inner: TInterceptorDef = {
      after: () => {
        // oxlint-disable-next-line no-throw-literal -- the case under test
        throw 'not an Error'
      },
    }

    expect(await runChain([outer, inner], () => 'ok')).toBe('caught')
    expect(catchError).toHaveBeenCalledWith('not an Error', expect.any(Function), 'ok')
    expect(outer.after).not.toHaveBeenCalled()
  })

  it('logs an error raised by an error hook when the handler had already raised', async () => {
    const error = vi.fn()
    const logger = { ...testLogger, error }
    const inner: TInterceptorDef = {
      error: () => {
        throw new Error('error hook failed')
      },
    }

    await expect(
      runChain(
        [inner],
        () => {
          throw new Error('handler failed')
        },
        logger,
      ),
    ).rejects.toThrow('error hook failed')
    expect(error.mock.calls.map((c) => String(c[0]))).toEqual([
      'Error: handler failed',
      'Error: error hook failed',
    ])
  })

  it('an unhandled error from an after hook is raised', async () => {
    const outer: TInterceptorDef = { after: vi.fn() }
    const inner: TInterceptorDef = {
      after: () => {
        throw new Error('nobody catches this')
      },
    }

    await expect(runChain([outer, inner], () => 'ok')).rejects.toThrow('nobody catches this')
    expect(outer.after).not.toHaveBeenCalled()
  })
})

describe('interceptor chain — class-based interceptors', () => {
  it('@OnError of an outer interceptor catches an error thrown by an inner @After', async () => {
    const seen: unknown[] = []

    // after/error hooks run in reverse priority order: AFTER_ALL first, BEFORE_ALL last
    @Interceptor(TInterceptorPriority.BEFORE_ALL)
    class Catcher {
      @OnError()
      catch(@Response() error: Error, @Overtake() reply: TOvertakeFn) {
        seen.push(error.message, useInterceptOriginal())
        reply({ caught: error.message })
      }
    }

    @Interceptor(TInterceptorPriority.AFTER_ALL)
    class Failer {
      @After()
      fail() {
        throw new Error('after failed')
      }
    }

    @Controller()
    class Ctrl {
      @FakeGet('a')
      @Intercept(Catcher)
      @Intercept(Failer)
      a() {
        return 'handler result'
      }
    }

    const { call } = await boot(Ctrl)
    expect(await call('/a')).toEqual({ caught: 'after failed' })
    expect(seen).toEqual(['after failed', 'handler result'])
  })
})
