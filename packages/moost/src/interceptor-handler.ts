import { getContextInjector } from '@wooksjs/event-core'

import type { TInterceptorAfterFn, TInterceptorDef, TInterceptorErrorFn } from './decorators'
import type { TInterceptorDefFactory } from './decorators/interceptor.decorator'
import { isThenable } from './shared-utils'

/** Entry for a single interceptor in the handler chain. */
export interface TInterceptorEntry {
  handler: TInterceptorDef | TInterceptorDefFactory
  name: string
  /** Pre-computed span name for ci.with(). */
  spanName: string
}

/** Span attributes of the interceptor stages — shared, never mutated. */
const BEFORE_STAGE = { 'moost.interceptor.stage': 'before' }
const AFTER_STAGE = { 'moost.interceptor.stage': 'after' }
const ON_ERROR_STAGE = { 'moost.interceptor.stage': 'onError' }

/** A registered after/onError hook of one event. */
interface TRegisteredHook<F> {
  /** Pre-computed span name for ci.with(). */
  spanName: string
  fn: F
}

/**
 * Manages the before/after/error interceptor lifecycle for a single event.
 * Optimised for the common sync path — only allocates promises when an interceptor goes async.
 */
export class InterceptorHandler {
  // Fields are `declare`d and assigned in the constructor — one plain store each, instead of
  // the per-field `defineProperty` helper class-field emit costs on every event.
  // Lazy — undefined until a def with after/error is registered
  declare protected after: TRegisteredHook<TInterceptorAfterFn>[] | undefined

  declare protected onError: TRegisteredHook<TInterceptorErrorFn>[] | undefined

  declare public response?: unknown

  declare public responseOverwritten: boolean

  declare protected _boundReplyFn?: (reply: unknown) => void

  declare protected handlers: TInterceptorEntry[]

  constructor(handlers: TInterceptorEntry[]) {
    this.handlers = handlers
    this.after = undefined
    this.onError = undefined
    this.response = undefined
    this.responseOverwritten = false
    this._boundReplyFn = undefined
  }

  protected getReplyFn() {
    return (this._boundReplyFn ??= (reply: unknown) => {
      this.response = reply
      this.responseOverwritten = true
    })
  }

  get count() {
    return this.handlers.length
  }

  get countAfter() {
    return this.after?.length ?? 0
  }

  get countOnError() {
    return this.onError?.length ?? 0
  }

  /**
   * Register hooks from a TInterceptorDef.
   * Returns a pending PromiseLike if `before` went async, or undefined.
   */
  private registerDef(
    def: TInterceptorDef,
    entry: TInterceptorEntry,
    ci: ReturnType<typeof getContextInjector<string>>,
  ): PromiseLike<unknown> | undefined {
    if (def.after) {
      ;(this.after ??= []).unshift({ spanName: entry.spanName, fn: def.after })
    }
    if (def.error) {
      ;(this.onError ??= []).unshift({ spanName: entry.spanName, fn: def.error })
    }
    if (def.before) {
      const result = ci
        ? ci.with(entry.spanName, BEFORE_STAGE, () => def.before?.(this.getReplyFn()))
        : def.before(this.getReplyFn())
      if (isThenable(result)) {
        return result
      }
    }
    return undefined
  }

  // Sync-first before: returns synchronously when all interceptors are sync (common case for guards)
  before(): unknown {
    const ci = getContextInjector<string>()
    for (let i = 0; i < this.handlers.length; i++) {
      const entry = this.handlers[i]
      const { handler } = entry

      if (typeof handler === 'function') {
        // Factory: call to produce a TInterceptorDef (instantiation + arg resolution spans are inside)
        const factoryResult = handler()
        if (isThenable(factoryResult)) {
          return this._beforeAsyncFactory(ci, factoryResult as PromiseLike<TInterceptorDef>, i)
        }
        // Sync factory returned a def
        const pending = this.registerDef(factoryResult as TInterceptorDef, entry, ci)
        if (pending) {
          return this._beforeAsyncPending(ci, pending, i)
        }
        if (this.responseOverwritten) {
          return this.response
        }
      } else {
        // Static TInterceptorDef: register hooks directly
        const pending = this.registerDef(handler, entry, ci)
        if (pending) {
          return this._beforeAsyncPending(ci, pending, i)
        }
        if (this.responseOverwritten) {
          return this.response
        }
      }
    }
  }

  private async _beforeAsyncFactory(
    ci: ReturnType<typeof getContextInjector<string>>,
    factoryPromise: PromiseLike<TInterceptorDef>,
    startIndex: number,
  ) {
    const def = await factoryPromise
    const entry = this.handlers[startIndex]
    const pending = this.registerDef(def, entry, ci)
    if (pending) {
      await pending
    }
    if (this.responseOverwritten) {
      return this.response
    }
    return this._beforeFrom(ci, startIndex + 1)
  }

  private async _beforeAsyncPending(
    ci: ReturnType<typeof getContextInjector<string>>,
    pending: PromiseLike<unknown>,
    startIndex: number,
  ) {
    await pending
    if (this.responseOverwritten) {
      return this.response
    }
    return this._beforeFrom(ci, startIndex + 1)
  }

  private async _beforeFrom(ci: ReturnType<typeof getContextInjector<string>>, startIndex: number) {
    for (let i = startIndex; i < this.handlers.length; i++) {
      const entry = this.handlers[i]
      const { handler } = entry

      let def: TInterceptorDef
      if (typeof handler === 'function') {
        def = (await handler()) as TInterceptorDef
      } else {
        def = handler
      }

      const pending = this.registerDef(def, entry, ci)
      if (pending) {
        await pending
      }
      if (this.responseOverwritten) {
        return this.response
      }
    }
  }

  fireAfter(response: unknown): unknown {
    this.response = response
    const isError = response instanceof Error
    const handlers = isError ? this.onError : this.after
    if (!handlers) {
      return this.response
    }
    const ci = getContextInjector<string>()
    const stage = isError ? ON_ERROR_STAGE : AFTER_STAGE
    for (let i = 0; i < handlers.length; i++) {
      const { spanName, fn } = handlers[i]
      const result = ci
        ? ci.with(spanName, stage, () => fn(response as Error & unknown, this.getReplyFn()))
        : fn(response as Error & unknown, this.getReplyFn())
      if (isThenable(result)) {
        return this._fireAfterAsync({ ci, handlers, stage, response }, result, i)
      }
    }
    return this.response
  }

  private async _fireAfterAsync(
    ctx: {
      ci: ReturnType<typeof getContextInjector<string>>
      handlers: TRegisteredHook<TInterceptorAfterFn | TInterceptorErrorFn>[]
      stage: Record<string, string>
      response: unknown
    },
    pending: PromiseLike<unknown>,
    startIndex: number,
  ) {
    await pending
    for (let i = startIndex + 1; i < ctx.handlers.length; i++) {
      const { spanName, fn } = ctx.handlers[i]
      if (ctx.ci) {
        await ctx.ci.with(spanName, ctx.stage, () =>
          fn(ctx.response as Error & unknown, this.getReplyFn()),
        )
      } else {
        await fn(ctx.response as Error & unknown, this.getReplyFn())
      }
    }
    return this.response
  }
}
