import { AsyncLocalStorage } from 'node:async_hooks'

import type { Context, ContextManager } from '@opentelemetry/api'
import { ROOT_CONTEXT } from '@opentelemetry/api'

/** Minimal AsyncLocalStorage context manager (what `@opentelemetry/context-async-hooks` provides). */
export class AlsContextManager implements ContextManager {
  private als = new AsyncLocalStorage<Context>()
  active() {
    return this.als.getStore() ?? ROOT_CONTEXT
  }
  with<A extends unknown[], F extends (...args: A) => ReturnType<F>>(
    ctx: Context,
    fn: F,
    thisArg?: ThisParameterType<F>,
    ...args: A
  ): ReturnType<F> {
    return this.als.run(ctx, () => fn.apply(thisArg, args))
  }
  bind<T>(_ctx: Context, target: T): T {
    return target
  }
  enable() {
    return this
  }
  disable() {
    this.als.disable()
    return this
  }
}
