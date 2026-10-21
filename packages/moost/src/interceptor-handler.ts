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

/** The after/error hooks of one interceptor def, registered for one event. */
interface TRegisteredHooks {
  /** Pre-computed span name for ci.with(). */
  spanName: string
  after?: TInterceptorAfterFn
  error?: TInterceptorErrorFn
}

/**
 * Manages the before/after/error interceptor lifecycle for a single event.
 * Optimised for the common sync path — only allocates promises when an interceptor goes async.
 */
export class InterceptorHandler {
  // Fields are `declare`d and assigned in the constructor — one plain store each, instead of
  // the per-field `defineProperty` helper class-field emit costs on every event.
  // Lazy — undefined until a def with after/error is registered. Innermost (registered last) first.
  declare protected hooks: TRegisteredHooks[] | undefined

  declare public response?: unknown

  /**
   * After {@link fireAfter}: whether the final value is raised (thrown) rather than returned.
   * Set by a hook that throws; cleared by a hook replying a non-Error value.
   */
  declare public raised: boolean

  declare public responseOverwritten: boolean

  declare protected _boundReplyFn?: (reply: unknown) => void

  declare protected handlers: TInterceptorEntry[]

  constructor(handlers: TInterceptorEntry[]) {
    this.handlers = handlers
    this.hooks = undefined
    this.response = undefined
    this.raised = false
    this.responseOverwritten = false
    this._boundReplyFn = undefined
  }

  protected getReplyFn() {
    return (this._boundReplyFn ??= (reply: unknown) => {
      this.response = reply
      this.responseOverwritten = true
      if (!(reply instanceof Error)) {
        this.raised = false // a non-Error reply recovers the chain
      }
    })
  }

  get count() {
    return this.handlers.length
  }

  /** Number of registered interceptors with an after and/or error hook. */
  get countHooks() {
    return this.hooks?.length ?? 0
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
    if (def.after || def.error) {
      ;(this.hooks ??= []).unshift({ spanName: entry.spanName, after: def.after, error: def.error })
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

  /**
   * Runs the after/error hooks as ONE chain over the current value, innermost interceptor
   * first. Each hook sees the current value (the previous hook's reply) and the `original`
   * value that entered the chain: a raised value or an `Error` runs the hook's `error` fn,
   * anything else its `after` fn. A hook that throws (anything), or replies with an `Error`,
   * switches the rest of the chain to error mode; a non-Error reply recovers it.
   *
   * `raised` tells whether `response` was thrown (by the handler or a before hook) rather than
   * returned; read {@link raised} afterwards for the final value's state.
   */
  fireAfter(response: unknown, raised = false): unknown {
    this.response = response
    this.raised = raised
    const hooks = this.hooks
    if (!hooks) {
      return response
    }
    const ci = getContextInjector<string>()
    for (let i = 0; i < hooks.length; i++) {
      const pending = this.runHook(ci, hooks[i], response)
      if (pending) {
        return this._fireAfterAsync(ci, response, pending, i)
      }
    }
    return this.response
  }

  /**
   * Runs one interceptor's hook for the current value: its `error` fn while the chain is in
   * error mode (a raised value — even a thrown non-Error — or an `Error`), else its `after` fn.
   * A sync throw switches the chain to error mode; an async hook's promise is returned for the
   * caller to await (its rejection switches to error mode there).
   */
  private runHook(
    ci: ReturnType<typeof getContextInjector<string>>,
    hook: TRegisteredHooks,
    original: unknown,
  ): PromiseLike<unknown> | undefined {
    const value = this.response
    const isError = this.raised || value instanceof Error
    const fn = isError ? hook.error : hook.after
    if (!fn) {
      return undefined
    }
    let result: unknown
    try {
      result = ci
        ? ci.with(hook.spanName, isError ? ON_ERROR_STAGE : AFTER_STAGE, () =>
            fn(value as Error & unknown, this.getReplyFn(), original),
          )
        : fn(value as Error & unknown, this.getReplyFn(), original)
    } catch (error) {
      this.raise(error)
      return undefined
    }
    return isThenable(result) ? (result as PromiseLike<unknown>) : undefined
  }

  /** A hook threw: the error becomes the current value, raised. */
  private raise(error: unknown) {
    this.response = error
    this.raised = true
  }

  private async _fireAfterAsync(
    ci: ReturnType<typeof getContextInjector<string>>,
    original: unknown,
    pending: PromiseLike<unknown>,
    startIndex: number,
  ) {
    const hooks = this.hooks as TRegisteredHooks[]
    let current: PromiseLike<unknown> | undefined = pending
    for (let i = startIndex + 1; ; i++) {
      if (current) {
        try {
          await current
        } catch (error) {
          this.raise(error) // a rejected hook switches the chain to error mode
        }
      }
      if (i >= hooks.length) {
        return this.response
      }
      current = this.runHook(ci, hooks[i], original)
    }
  }
}
