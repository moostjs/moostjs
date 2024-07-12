import { getContextInjector } from '@wooksjs/event-core'

import type {
  TInterceptorAfter,
  TInterceptorBefore,
  TInterceptorFn,
  TInterceptorOnError,
} from './decorators'

export class InterceptorHandler {
  constructor(protected handlers: Array<{ handler: TInterceptorFn; name: string }>) {}

  protected before: Array<{ name: string; fn: TInterceptorBefore }> = []

  protected after: Array<{ name: string; fn: TInterceptorAfter }> = []

  protected onError: Array<{ name: string; fn: TInterceptorOnError }> = []

  public response?: unknown

  public responseOverwritten = false

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

  replyFn(reply: unknown) {
    this.response = reply
    this.responseOverwritten = true
  }

  async init() {
    const ci = getContextInjector<string>()
    for (const { handler, name } of this.handlers) {
      const response = await ci.with(
        `Interceptor:${name}`,
        {
          'moost.interceptor.stage': 'init',
        },
        () =>
          handler(
            fn => {
              this.before.push({ name, fn })
            },
            fn => {
              this.after.unshift({ name, fn })
            },
            fn => {
              this.onError.unshift({ name, fn })
            }
          )
      )
      if (response !== undefined) {
        return response
      }
    }
  }

  async fireBefore(response: unknown) {
    const ci = getContextInjector<string>()
    this.response = response
    for (const { name, fn } of this.before) {
      await ci.with(
        `Interceptor:${name}`,
        {
          'moost.interceptor.stage': 'before',
        },
        () => fn(this.replyFn.bind(this))
      )
      if (this.responseOverwritten) {
        break
      }
    }
    return this.response
  }

  async fireAfter(response: unknown) {
    const ci = getContextInjector<string>()
    this.response = response
    if (response instanceof Error) {
      for (const { name, fn } of this.onError) {
        await ci.with(
          `Interceptor:${name}`,
          {
            'moost.interceptor.stage': 'after',
          },
          () => fn(response, this.replyFn.bind(this))
        )
      }
    } else {
      for (const { name, fn } of this.after) {
        await ci.with(
          `Interceptor:${name}`,
          {
            'moost.interceptor.stage': 'onError',
          },
          () => fn(response, this.replyFn.bind(this))
        )
      }
    }
    return this.response
  }
}
