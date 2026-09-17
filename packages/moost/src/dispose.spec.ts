// oxlint-disable max-classes-per-file -- one isolated throwaway class per case
import { describe, expect, it, vi } from 'vitest'

import { MoostDispose } from './decorators/dispose.decorator'
import { disposeInstances } from './dispose'

/** Minimal `TConsoleBase` stand-in capturing `warn` calls. */
function fakeLogger() {
  const warn = vi.fn()
  return {
    logger: { error: vi.fn(), warn, log: vi.fn(), info: vi.fn(), debug: vi.fn(), trace: vi.fn() },
    warn,
  }
}

const hasDispose = typeof Symbol.dispose === 'symbol'
const hasAsyncDispose = typeof Symbol.asyncDispose === 'symbol'

describe('disposeInstances', () => {
  it('runs a decorated hook and reports counts', async () => {
    const order: string[] = []

    class Owner {
      @MoostDispose()
      close() {
        order.push('closed')
      }
    }

    const result = await disposeInstances([new Owner()])

    expect(order).toEqual(['closed'])
    expect(result.hooks).toBe(1)
    expect(result.errors).toEqual([])
    expect(result.disposed).toHaveLength(1)
  })

  it('ignores instances with no hook (not counted, not reported as disposed)', async () => {
    class Plain {
      close() {
        throw new Error('never called — not decorated')
      }
    }

    const result = await disposeInstances([new Plain(), {}])

    expect(result).toEqual({ hooks: 0, errors: [], disposed: [] })
  })

  it.skipIf(!hasDispose)('honors a plain object with [Symbol.dispose]', async () => {
    const order: string[] = []
    const obj = {
      [Symbol.dispose]() {
        order.push('sync')
      },
    }

    const result = await disposeInstances([obj])

    expect(order).toEqual(['sync'])
    expect(result.hooks).toBe(1)
  })

  it.skipIf(!hasAsyncDispose || !hasDispose)(
    'prefers [Symbol.asyncDispose] and awaits it',
    async () => {
      const order: string[] = []
      const obj = {
        async [Symbol.asyncDispose]() {
          await new Promise((resolve) => setTimeout(resolve, 5))
          order.push('async')
        },
        [Symbol.dispose]() {
          order.push('sync')
        },
      }

      await disposeInstances([obj])

      expect(order).toEqual(['async'])
    },
  )

  it.skipIf(!hasDispose)('prefers a decorated hook over [Symbol.dispose]', async () => {
    const order: string[] = []

    class Both {
      @MoostDispose()
      close() {
        order.push('decorated')
      }

      [Symbol.dispose]() {
        order.push('symbol')
      }
    }

    await disposeInstances([new Both()])

    expect(order).toEqual(['decorated'])
  })

  it('runs hooks in ascending priority, input order for ties', async () => {
    const order: string[] = []

    class Late {
      @MoostDispose({ priority: 10 })
      close() {
        order.push('late')
      }
    }

    class Early {
      @MoostDispose({ priority: -5 })
      close() {
        order.push('early')
      }
    }

    class Tie {
      constructor(private readonly name: string) {}

      @MoostDispose()
      close() {
        order.push(this.name)
      }
    }

    await disposeInstances([new Late(), new Tie('tie-a'), new Early(), new Tie('tie-b')])

    expect(order).toEqual(['early', 'tie-a', 'tie-b', 'late'])
  })

  it('awaits async hooks sequentially', async () => {
    const order: string[] = []

    class Slow {
      @MoostDispose({ priority: 0 })
      async close() {
        await new Promise((resolve) => setTimeout(resolve, 15))
        order.push('slow')
      }
    }

    class Fast {
      @MoostDispose({ priority: 1 })
      close() {
        order.push('fast')
      }
    }

    await disposeInstances([new Fast(), new Slow()])

    expect(order).toEqual(['slow', 'fast'])
  })

  it('is idempotent per instance', async () => {
    const order: string[] = []

    class Once {
      @MoostDispose()
      close() {
        order.push('closed')
      }
    }

    const instance = new Once()
    const first = await disposeInstances([instance])
    const second = await disposeInstances([instance])

    expect(order).toEqual(['closed'])
    expect(first.hooks).toBe(1)
    expect(second.hooks).toBe(0)
  })

  it('warns and continues by default when a hook throws', async () => {
    const order: string[] = []
    const { logger, warn } = fakeLogger()

    class Bad {
      @MoostDispose({ priority: 0 })
      close() {
        throw new Error('boom')
      }
    }

    class Good {
      @MoostDispose({ priority: 1 })
      close() {
        order.push('good')
      }
    }

    const result = await disposeInstances([new Bad(), new Good()], { logger })

    expect(order).toEqual(['good']) // the later hook still ran
    expect(result.hooks).toBe(2)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].method).toBe('close')
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Bad.close'))
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('boom'))
  })

  it('runs every hook, then throws one AggregateError with onError: "throw"', async () => {
    const order: string[] = []

    class Bad {
      @MoostDispose({ priority: 0 })
      close() {
        throw new Error('boom')
      }
    }

    class Good {
      @MoostDispose({ priority: 1 })
      close() {
        order.push('good')
      }
    }

    const caught = await disposeInstances([new Bad(), new Good()], { onError: 'throw' }).catch(
      (error: unknown) => error,
    )

    expect(order).toEqual(['good'])
    expect(caught).toBeInstanceOf(AggregateError)
    expect((caught as AggregateError).message).toContain('Bad.close (boom)')
    expect((caught as AggregateError).errors).toHaveLength(1)
  })

  it('never evaluates getters while scanning for hooks', async () => {
    const order: string[] = []

    class Trap {
      get exploding(): string {
        throw new Error('getter must not be evaluated')
      }

      @MoostDispose()
      close() {
        order.push('closed')
      }
    }

    await expect(disposeInstances([new Trap()])).resolves.toMatchObject({ hooks: 1 })
    expect(order).toEqual(['closed'])
  })
})
