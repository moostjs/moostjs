import type { TConsoleBase } from '@prostojs/logger'

import { getInstanceOwnMethods } from './binding/utils'
import { getDefaultLogger } from './logger'
import { getMoostMate } from './metadata/moost-metadata'

/** One failed dispose hook: the instance, the method that threw, and the thrown value. */
export interface TDisposeError {
  instance: object
  method: string | symbol
  error: unknown
}

/** Outcome of {@link disposeInstances}: how many hooks ran, and which of them failed. */
export interface TDisposeResult {
  /** Number of hooks invoked (a class may declare several). */
  hooks: number
  /** Failed hooks, in run order. */
  errors: TDisposeError[]
  /**
   * Instances that had at least one hook invoked — i.e. the ones actually torn
   * down, as opposed to the ones passed in that declare no hook at all.
   */
  disposed: object[]
}

/** Options for {@link disposeInstances}. */
export interface TDisposeOptions {
  /** Logger for `onError: 'warn'` diagnostics; defaults to the Moost default logger. */
  logger?: TConsoleBase
  /**
   * `'warn'` (default) — log every failure and keep going;
   * `'throw'` — still run every hook, then throw one `AggregateError`.
   */
  onError?: 'warn' | 'throw'
}

interface TDisposeHook {
  instance: object
  method: string | symbol
  priority: number
}

/**
 * Instances whose dispose hooks already ran. Module-level and weak, so
 * disposal is at-most-once per instance no matter which entry point triggers
 * it — `Moost.dispose()` twice, or a hot-reload eject followed by a shutdown,
 * never re-runs a hook.
 */
const disposedInstances = new WeakSet<object>()

const DISPOSE_BANNER = `${__DYE_DIM__ + __DYE_MAGENTA__}moost`

/**
 * `Symbol.asyncDispose` / `Symbol.dispose` are only present on newer runtimes —
 * resolve them once through a guarded read so older ones simply have no
 * well-known fallback hook.
 */
const asyncDisposeSymbol: symbol | undefined =
  typeof Symbol.asyncDispose === 'symbol' ? Symbol.asyncDispose : undefined
const disposeSymbol: symbol | undefined =
  typeof Symbol.dispose === 'symbol' ? Symbol.dispose : undefined

/** Class name of an instance, read through the prototype (never touches own props). */
function classNameOf(instance: object): string {
  const proto = Object.getPrototypeOf(instance) as { constructor?: { name?: string } } | null
  return proto?.constructor?.name || 'Object'
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** `Class.method (message)` pairs for every failed hook. */
function formatDisposeErrors(errors: TDisposeError[]): string {
  const list = errors
    .map((e) => `${classNameOf(e.instance)}.${String(e.method)} (${errorMessage(e.error)})`)
    .join(', ')
  return `[moost] ${errors.length} dispose hook(s) failed: ${list}`
}

/**
 * True when `sym` resolves to a data property holding a function anywhere on the
 * instance/prototype chain. Descriptor based — accessors are never invoked.
 */
function hasSymbolMethod(instance: object, sym: symbol | undefined): boolean {
  if (!sym) {
    return false
  }
  let obj: object | null = instance
  while (obj && obj !== Object.prototype) {
    const desc = Object.getOwnPropertyDescriptor(obj, sym)
    if (desc) {
      return typeof desc.value === 'function'
    }
    obj = Object.getPrototypeOf(obj) as object | null
  }
  return false
}

/**
 * Dispose hooks of one instance: every `@MoostDispose`-decorated method or —
 * when the class decorates none — its `Symbol.asyncDispose` / `Symbol.dispose`
 * method (preferring the async one) as a single priority-0 hook. The method
 * scan goes through `getInstanceOwnMethods`, which classifies by descriptor and
 * never evaluates getters.
 */
function collectHooks(instance: object): TDisposeHook[] {
  const mate = getMoostMate()
  const hooks: TDisposeHook[] = []
  for (const method of getInstanceOwnMethods(instance as Record<string, unknown>)) {
    const priority = mate.read(instance, method)?.moostDispose?.priority
    if (typeof priority === 'number') {
      hooks.push({ instance, method, priority })
    }
  }
  if (hooks.length > 0) {
    return hooks
  }
  const sym = hasSymbolMethod(instance, asyncDisposeSymbol)
    ? asyncDisposeSymbol
    : hasSymbolMethod(instance, disposeSymbol)
      ? disposeSymbol
      : undefined
  return sym ? [{ instance, method: sym, priority: 0 }] : []
}

async function runHook(hook: TDisposeHook, errors: TDisposeError[], opts?: TDisposeOptions) {
  const fn = (hook.instance as Record<string | symbol, unknown>)[hook.method] as () => unknown
  try {
    await fn.call(hook.instance)
  } catch (error) {
    errors.push({ instance: hook.instance, method: hook.method, error })
    if (opts?.onError !== 'throw') {
      const logger = opts?.logger || getDefaultLogger(DISPOSE_BANNER)
      logger.warn(
        `[moost] dispose hook ${classNameOf(hook.instance)}.${String(
          hook.method,
        )} failed: ${errorMessage(error)}`,
      )
    }
  }
}

/**
 * Runs the dispose hooks of every given instance, once per instance, ever.
 *
 * A hook is either a `@MoostDispose()`-decorated method or, when the class
 * decorates none, the instance's `[Symbol.asyncDispose]()` / `[Symbol.dispose]()`
 * method. Hooks run **sequentially** in ascending `priority` (ties keep input
 * order) and each one is awaited, so teardown that must happen in order (drain
 * consumers, then close the connection they use) can be expressed with
 * priorities.
 *
 * Failures never stop the run: with `onError: 'warn'` (default) each one is
 * logged and collected; with `onError: 'throw'` every hook still runs and one
 * `AggregateError` is thrown at the end.
 *
 * Instances already disposed (by an earlier call, or by `Moost.dispose()`) are
 * skipped, so passing overlapping sets is safe.
 */
export async function disposeInstances(
  instances: Iterable<object>,
  opts?: TDisposeOptions,
): Promise<TDisposeResult> {
  const hooks: TDisposeHook[] = []
  const disposed: object[] = []
  for (const instance of instances) {
    if (!instance || disposedInstances.has(instance)) {
      continue
    }
    disposedInstances.add(instance)
    const own = collectHooks(instance)
    if (own.length > 0) {
      disposed.push(instance)
      hooks.push(...own)
    }
  }
  const errors: TDisposeError[] = []
  for (const hook of hooks.toSorted((a, b) => a.priority - b.priority)) {
    await runHook(hook, errors, opts)
  }
  if (opts?.onError === 'throw' && errors.length > 0) {
    throw new AggregateError(
      errors.map((e) => e.error),
      formatDisposeErrors(errors),
    )
  }
  return { hooks: hooks.length, errors, disposed }
}

/**
 * @internal Renders the aggregate message used when disposal failures are
 * rethrown (`Moost.dispose()` and `disposeInstances(..., { onError: 'throw' })`).
 */
export function describeDisposeErrors(errors: TDisposeError[]): string {
  return formatDisposeErrors(errors)
}
