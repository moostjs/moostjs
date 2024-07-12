import { getContextInjector } from '@wooksjs/event-core'

import type {
  TInterceptorAfter,
  TInterceptorBefore,
  TInterceptorFn,
  TInterceptorOnError,
} from './decorators'

export class InterceptorHandler {
  constructor(protected handlers: TInterceptorFn[]) {}

  protected before: Array<{ handler: TInterceptorFn; fn: TInterceptorBefore }> = []

  protected after: Array<{ handler: TInterceptorFn; fn: TInterceptorAfter }> = []

  protected onError: Array<{ handler: TInterceptorFn; fn: TInterceptorOnError }> = []

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
    for (const handler of this.handlers) {
      const response = await ci.with(
        `Inteceptor:${handler.name}`,
        {
          'moost.interceptor.stage': 'init',
          'moost.interceptor.priority': handler.priority || '',
        },
        () =>
          handler(
            fn => {
              this.before.push({ handler, fn })
            },
            fn => {
              this.after.unshift({ handler, fn })
            },
            fn => {
              this.onError.unshift({ handler, fn })
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
    for (const { handler, fn } of this.before) {
      await ci.with(
        `Inteceptor:${handler.name}`,
        {
          'moost.interceptor.stage': 'before',
          'moost.interceptor.priority': handler.priority || '',
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
      for (const { handler, fn } of this.onError) {
        await ci.with(
          `Inteceptor:${handler.name}`,
          {
            'moost.interceptor.stage': 'after',
            'moost.interceptor.priority': handler.priority || '',
          },
          () => fn(response, this.replyFn.bind(this))
        )
      }
    } else {
      for (const { handler, fn } of this.after) {
        await ci.with(
          `Inteceptor:${handler.name}`,
          {
            'moost.interceptor.stage': 'onError',
            'moost.interceptor.priority': handler.priority || '',
          },
          () => fn(response, this.replyFn.bind(this))
        )
      }
    }
    return this.response
  }
}
