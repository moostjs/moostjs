import { useEventContext } from '@wooksjs/event-core'

import type {
  TInterceptorAfter,
  TInterceptorBefore,
  TInterceptorFn,
  TInterceptorOnError,
} from './decorators'

export class InterceptorHandler {
  constructor(protected handlers: TInterceptorFn[]) {}

  protected before: TInterceptorBefore[] = []

  protected after: TInterceptorAfter[] = []

  protected onError: TInterceptorOnError[] = []

  public response?: unknown

  public responseOverwritten = false

  replyFn(reply: unknown) {
    this.response = reply
    this.responseOverwritten = true
  }

  async init() {
    const { restoreCtx } = useEventContext()
    for (const handler of this.handlers) {
      restoreCtx()
      const response = await handler(
        fn => {
          this.before.push(fn)
        },
        fn => {
          this.after.unshift(fn)
        },
        fn => {
          this.onError.unshift(fn)
        }
      )
      if (response !== undefined) {
        return response
      }
    }
  }

  async fireBefore(response: unknown) {
    const { restoreCtx } = useEventContext()
    this.response = response
    for (const handler of this.before) {
      restoreCtx()
      await handler(this.replyFn.bind(this))
      if (this.responseOverwritten) {
        break
      }
    }
    return this.response
  }

  async fireAfter(response: unknown) {
    const { restoreCtx } = useEventContext()
    this.response = response
    if (response instanceof Error) {
      for (const handler of this.onError) {
        restoreCtx()
        await handler(response, this.replyFn.bind(this))
      }
    } else {
      for (const handler of this.after) {
        restoreCtx()
        await handler(response, this.replyFn.bind(this))
      }
    }
    return this.response
  }
}
