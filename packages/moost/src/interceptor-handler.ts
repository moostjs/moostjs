import { getContextInjector } from '@wooksjs/event-core'

import type {
  TInterceptorAfter,
  TInterceptorBefore,
  TInterceptorFn,
  TInterceptorOnError,
} from './decorators'

function isThenable(value: unknown): value is PromiseLike<unknown> {
  return (
    value !== null &&
    value !== undefined &&
    typeof (value as PromiseLike<unknown>).then === 'function'
  )
}

export class InterceptorHandler {
  constructor(protected handlers: { handler: TInterceptorFn; name: string }[]) {}

  protected before: { name: string; fn: TInterceptorBefore }[] = []

  protected after: { name: string; fn: TInterceptorAfter }[] = []

  protected onError: { name: string; fn: TInterceptorOnError }[] = []

  public response?: unknown

  public responseOverwritten = false

  protected _boundReplyFn?: (reply: unknown) => void

  protected getReplyFn() {
    return (this._boundReplyFn ??= (reply: unknown) => {
      this.response = reply
      this.responseOverwritten = true
    })
  }

  get count() {
    return this.handlers.length
  }

  get countBefore() {
    return this.before.length
  }

  get countAfter() {
    return this.after.length
  }

  get countOnError() {
    return this.onError.length
  }

  // Sync-first init: returns synchronously when all interceptors are sync (common case for guards)
  init(): unknown {
    const ci = getContextInjector<string>()
    for (let i = 0; i < this.handlers.length; i++) {
      const { handler, name } = this.handlers[i]
      const response = ci.with(
        `Interceptor:${name}`,
        {
          'moost.interceptor.stage': 'init',
        },
        () =>
          handler(
            (fn) => {
              this.before.push({ name, fn })
            },
            (fn) => {
              this.after.unshift({ name, fn })
            },
            (fn) => {
              this.onError.unshift({ name, fn })
            },
          ),
      )
      if (isThenable(response)) {
        return this._initAsync(ci, response, i)
      }
      if (response !== undefined) {
        return response
      }
    }
  }

  private async _initAsync(
    ci: ReturnType<typeof getContextInjector<string>>,
    pending: PromiseLike<unknown>,
    startIndex: number,
  ) {
    let response = await pending
    if (response !== undefined) {
      return response
    }
    for (let i = startIndex + 1; i < this.handlers.length; i++) {
      const { handler, name } = this.handlers[i]
      response = await ci.with(
        `Interceptor:${name}`,
        {
          'moost.interceptor.stage': 'init',
        },
        () =>
          handler(
            (fn) => {
              this.before.push({ name, fn })
            },
            (fn) => {
              this.after.unshift({ name, fn })
            },
            (fn) => {
              this.onError.unshift({ name, fn })
            },
          ),
      )
      if (response !== undefined) {
        return response
      }
    }
  }

  fireBefore(response: unknown): unknown {
    const ci = getContextInjector<string>()
    this.response = response
    for (let i = 0; i < this.before.length; i++) {
      const { name, fn } = this.before[i]
      const result = ci.with(
        `Interceptor:${name}`,
        {
          'moost.interceptor.stage': 'before',
        },
        () => fn(this.getReplyFn()),
      )
      if (isThenable(result)) {
        return this._fireBeforeAsync(ci, result, i)
      }
      if (this.responseOverwritten) {
        break
      }
    }
    return this.response
  }

  private async _fireBeforeAsync(
    ci: ReturnType<typeof getContextInjector<string>>,
    pending: PromiseLike<unknown>,
    startIndex: number,
  ) {
    await pending
    if (this.responseOverwritten) {
      return this.response
    }
    for (let i = startIndex + 1; i < this.before.length; i++) {
      const { name, fn } = this.before[i]
      await ci.with(
        `Interceptor:${name}`,
        {
          'moost.interceptor.stage': 'before',
        },
        () => fn(this.getReplyFn()),
      )
      if (this.responseOverwritten) {
        break
      }
    }
    return this.response
  }

  fireAfter(response: unknown): unknown {
    const ci = getContextInjector<string>()
    this.response = response
    if (response instanceof Error) {
      for (let i = 0; i < this.onError.length; i++) {
        const { name, fn } = this.onError[i]
        const result = ci.with(
          `Interceptor:${name}`,
          {
            'moost.interceptor.stage': 'onError',
          },
          () => fn(response, this.getReplyFn()),
        )
        if (isThenable(result)) {
          return this._fireAfterErrorAsync(ci, response, result, i)
        }
      }
    } else {
      for (let i = 0; i < this.after.length; i++) {
        const { name, fn } = this.after[i]
        const result = ci.with(
          `Interceptor:${name}`,
          {
            'moost.interceptor.stage': 'after',
          },
          () => fn(response, this.getReplyFn()),
        )
        if (isThenable(result)) {
          return this._fireAfterSuccessAsync(ci, response, result, i)
        }
      }
    }
    return this.response
  }

  private async _fireAfterErrorAsync(
    ci: ReturnType<typeof getContextInjector<string>>,
    error: Error,
    pending: PromiseLike<unknown>,
    startIndex: number,
  ) {
    await pending
    for (let i = startIndex + 1; i < this.onError.length; i++) {
      const { name, fn } = this.onError[i]
      await ci.with(
        `Interceptor:${name}`,
        {
          'moost.interceptor.stage': 'onError',
        },
        () => fn(error, this.getReplyFn()),
      )
    }
    return this.response
  }

  private async _fireAfterSuccessAsync(
    ci: ReturnType<typeof getContextInjector<string>>,
    response: unknown,
    pending: PromiseLike<unknown>,
    startIndex: number,
  ) {
    await pending
    for (let i = startIndex + 1; i < this.after.length; i++) {
      const { name, fn } = this.after[i]
      await ci.with(
        `Interceptor:${name}`,
        {
          'moost.interceptor.stage': 'after',
        },
        () => fn(response, this.getReplyFn()),
      )
    }
    return this.response
  }
}
