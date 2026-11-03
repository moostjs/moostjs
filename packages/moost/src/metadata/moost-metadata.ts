import type { TProvideRegistry, TReplaceRegistry } from '@prostojs/infact'
import type { TMateParamMeta } from '@prostojs/mate'
import { getConstructor, Mate } from '@prostojs/mate'

import type { TAny, TClassConstructor, TEmpty, TFunction, TObject } from '../common-types'
import type { TInterceptorDef, TInterceptorPriority } from '../decorators/intercept.decorator'
import type { TDecoratorLevel } from '../decorators/types'
import { stampOnce } from '../module-identity'
import type { TPipeData, TPipeMetas } from '../pipes'

const METADATA_WORKSPACE = 'moost'

/** Core metadata shape attached to classes, methods, and properties by Moost decorators. */
export interface TMoostMetadata<H extends TObject = TEmpty>
  extends TCommonMetaFields, TCommonMoostMeta {
  requiredProps?: (string | symbol)[]
  controller?: {
    prefix?: string
  }
  importController?: {
    prefix?: string
    typeResolver?:
      | TClassConstructor
      | (() => TClassConstructor | TObject | Promise<TClassConstructor | TObject>)
    provide?: TProvideRegistry
  }[]
  properties?: (string | symbol)[]
  injectable?: true | TInjectableScope
  interceptor?: { priority: TInterceptorPriority }
  interceptorHook?: 'before' | 'after' | 'error'
  interceptors?: TInterceptorData[]
  handlers?: TMoostHandler<H>[]
  returnType?: TFunction
  provide?: TProvideRegistry
  replace?: TReplaceRegistry
  loggerTopic?: string
  /**
   * Set by `@MoostInit()` — marks a method to run once after all controllers
   * are bound and before adapters start serving. `priority` orders hooks
   * (ascending) across all controllers.
   */
  moostInit?: { priority: number }
  /**
   * Set by `@MoostDispose()` — marks a method to run when the instance is
   * disposed (`Moost.dispose()`, or a hot-reload eject in `@moostjs/vite`).
   * `priority` orders hooks (ascending) across all instances.
   */
  moostDispose?: { priority: number }
  params: (TMateParamMeta & TMoostParamsMetadata)[]
}

/** Metadata attached to constructor/method parameters by Moost decorators. */
export interface TMoostParamsMetadata extends TCommonMetaFields, TCommonMoostMeta {
  circular?: () => TAny
  inject?: string | symbol | TClassConstructor
  nullable?: boolean
  paramSource?: string
  paramName?: string
  fromScope?: string | symbol // for infact scope
}

/** DI scope for injectable classes: per-event or application-wide singleton. */
export type TInjectableScope = 'FOR_EVENT' | 'SINGLETON'

/** Describes a registered handler (HTTP route, CLI command, workflow step, etc.). */
export type TMoostHandler<T> = {
  type: string
  path?: string
} & T

/** Stored interceptor entry attached to a class or method via `@Intercept`. */
export interface TInterceptorData {
  handler: TClassConstructor | TInterceptorDef
  priority: TInterceptorPriority
  name: string
}

/**
 * A param entry is "bare" when it carries nothing but the design-time type
 * (auto-captured from `design:paramtypes` the moment any decorator touches the
 * method). Bare entries mean the override declared no param decorators of its
 * own, so the parent's param metadata (resolvers, pipes, …) should survive.
 */
function isBareParam(param?: TMoostMetadata['params'][number]) {
  return (
    !param || Object.entries(param).every(([key, value]) => key === 'type' || value === undefined)
  )
}

/**
 * List keys that describe behaviour stacked on a class or method. Under
 * `@Inherit()` they ACCUMULATE along `extends` (base entries first, then the
 * subclass's own) instead of following the shallow own-wins merge — a subclass
 * adding a guard must not silently drop the base's error mapping or guard.
 * `authTransports` is written by `@Authenticate` (event-http) next to its
 * interceptor entry and has to travel with it. Route `handlers`, params,
 * `importController` (re-mounting would duplicate routes) and documentation
 * lists (swagger tags/security, …) keep own-wins semantics.
 */
const ACCUMULATED_KEYS = [
  'interceptors',
  'pipes',
  'authTransports',
  'properties',
  'requiredProps',
] as const

/**
 * The identity an entry is deduplicated by when it appears on both levels: the
 * `handler` reference for interceptor/pipe entries, the value itself otherwise.
 */
function entryIdentity(entry: unknown): unknown {
  return (entry as { handler?: unknown } | undefined)?.handler ?? entry
}

/**
 * Inherited entries first, then the own ones. An own entry that re-declares an
 * inherited one (same identity) takes the inherited entry's place.
 */
function accumulate(inherited: unknown[], own: unknown[]): unknown[] {
  const ownById = new Map<unknown, unknown>()
  for (const entry of own) {
    const id = entryIdentity(entry)
    if (!ownById.has(id)) {
      ownById.set(id, entry)
    }
  }
  const result: unknown[] = []
  const placed = new Set<unknown>()
  for (const entry of inherited) {
    const id = entryIdentity(entry)
    if (ownById.has(id)) {
      placed.add(id)
      result.push(ownById.get(id))
    } else {
      result.push(entry)
    }
  }
  for (const entry of own) {
    if (!placed.has(entryIdentity(entry))) {
      result.push(entry)
    }
  }
  return result
}

interface TOwnMetaReader {
  getOwnMetadata(key: string, target: object, propKey?: string | symbol): unknown
}

class MoostMate extends Mate<TMoostMetadata, TMoostMetadata> {
  /**
   * Read results whose accumulated keys are already settled. Mate caches reads and hands back the
   * same object on a hit; this skips re-accumulating (and re-reading own/parent meta) for it.
   */
  private readonly settled = new WeakSet<object>()

  override read<PK>(target: TFunction | TObject, propKey?: PK) {
    const result = super.read(target, propKey)
    const meta = result as Record<string, unknown> | undefined
    if (!meta || this.settled.has(meta)) {
      return result
    }
    this.settled.add(meta)
    const ctor = getConstructor(target)
    const own = (Reflect as unknown as TOwnMetaReader).getOwnMetadata(
      this.workspace,
      typeof propKey === 'string' ? (ctor.prototype as object) : ctor,
      propKey as string | undefined,
    ) as Record<string, unknown> | undefined
    // `meta === own`: nothing was inherited. No own meta: the inherited lists are kept as is.
    // Otherwise Mate built a fresh `{ ...inherited, ...own }` object, safe to amend.
    if (own && meta !== own) {
      const inherited = this.read(Object.getPrototypeOf(ctor) as TFunction, propKey) as
        | Record<string, unknown>
        | undefined
      for (const key of ACCUMULATED_KEYS) {
        const ownList = own[key]
        const inheritedList = inherited?.[key]
        if (Array.isArray(ownList) && Array.isArray(inheritedList) && inheritedList.length > 0) {
          meta[key] = accumulate(inheritedList, ownList)
        }
      }
    }
    return result
  }
}

const moostMate = new MoostMate(METADATA_WORKSPACE, {
  readType: true,
  readReturnType: true,
  collectPropKeys: true,
  // Returning true makes Mate merge parent meta shallowly, own keys winning
  // (except `ACCUMULATED_KEYS`, which `MoostMate.read` concatenates) —
  // so under class-level `@Inherit()` a decorated override keeps the parent's
  // route/guard metadata instead of silently dropping it (see the `Inherit`
  // decorator docs for the user-facing semantics). PARAM is evaluated per-index
  // only after PROP inheritance applied.
  inherit(classMeta, targetMeta, level) {
    if (targetMeta?.inherit === false) {
      return false
    }
    if (level === 'CLASS') {
      return !!classMeta?.inherit
    }
    if (level === 'PROP') {
      return !!targetMeta?.inherit || !!classMeta?.inherit
    }
    return !!targetMeta?.inherit || isBareParam(targetMeta as TMoostMetadata['params'][number])
  },
})

/** Returns the shared `Mate` instance operating in the `'moost'` metadata workspace. */
export function getMoostMate<
  Class extends TObject = TEmpty,
  Prop extends TObject = TEmpty,
  Param extends TObject = TEmpty,
>() {
  // reachable duplicate-copy check: `sideEffects: false` lets bundlers drop
  // the module-scope stamp; first decorator use is where copies diverge
  stampOnce()
  return moostMate as unknown as Mate<
    TMoostMetadata & Class & { params: (Param & TMateParamMeta)[] },
    TMoostMetadata & Prop & { params: (Param & TMateParamMeta)[] }
  >
}

interface TCommonMetaFields {
  id?: string
  label?: string
  value?: unknown
  description?: string
  optional?: boolean
  required?: boolean
}

interface TCommonMoostMeta {
  inherit?: boolean
  pipes?: TPipeData[]
  resolver?: (metas: TPipeMetas<TAny>, level: TDecoratorLevel) => unknown
  type?: TFunction
}
