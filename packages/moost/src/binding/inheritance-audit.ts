import type { TClassConstructor } from '../common-types'
import type { TMoostMetadata } from '../metadata'
import { getMoostMate } from '../metadata'
import type { TParamAuditFinding } from './param-audit'
import { ancestorsOf } from './utils'

/** Mode for the bind-time inheritance audit (see `TMoostOptions['diagnostics']`). */
export type TInheritanceAuditMode = 'warn' | 'off'

/** Input for {@link auditInheritance} — one registered controller, as bound. */
export interface TInheritanceAuditInput {
  /** Registered controller class (constructor of the instance for instance registrations). */
  classConstructor: TClassConstructor
  /** Effective metadata (`getMoostMate().read(...)` — inherit rules applied). */
  classMeta?: TMoostMetadata
  /** Handler metas discovered on the class at bind time (post-inheritance). */
  ownHandlersCount: number
  /** True when the class was registered as a constructor — DI will instantiate it. */
  diInstantiated: boolean
}

/** Counts handler metas on the class' own prototype methods (its inherit rules applied). */
function countHandlers(classConstructor: TClassConstructor): number {
  const mate = getMoostMate()
  let count = 0
  for (const name of Object.getOwnPropertyNames(classConstructor.prototype as object)) {
    if (name !== 'constructor') {
      count += mate.read(classConstructor, name)?.handlers?.length ?? 0
    }
  }
  return count
}

/**
 * Names the classes strictly between `classConstructor` and `ancestor` that
 * carry no truthy `@Inherit` — the links that break the metadata bridge
 * (both `@Inherit()` and the parent-params fallback cross one level at a time).
 */
function brokenLinksBetween(
  classConstructor: TClassConstructor,
  ancestor: TClassConstructor,
): string[] {
  const mate = getMoostMate()
  const links: string[] = []
  for (const parent of ancestorsOf(classConstructor)) {
    if (parent === ancestor) {
      break
    }
    if (!mate.read(parent)?.inherit) {
      links.push(parent.name)
    }
  }
  return links
}

/**
 * Route-drop trap: the registered class contributed 0 handlers while an
 * ancestor defines some — its routes silently 404. Fires when the class
 * carries no `@Inherit` decision (routes never flow by default) AND when it
 * carries `@Inherit()` but nothing flowed (that combination is always a bridge
 * broken by intermediate classes without `@Inherit()` of their own). An
 * explicit `@Inherit(false)` is a deliberate opt-out and stays silent.
 */
function auditRouteDrop(input: TInheritanceAuditInput): TParamAuditFinding | undefined {
  if (input.ownHandlersCount > 0 || input.classMeta?.inherit === false) {
    return undefined
  }
  for (const ancestor of ancestorsOf(input.classConstructor)) {
    const count = countHandlers(ancestor)
    if (count > 0) {
      return { severity: 'warn-only', message: routeDropMessage(input, ancestor, count) }
    }
  }
  return undefined
}

function routeDropMessage(
  input: TInheritanceAuditInput,
  ancestor: TClassConstructor,
  count: number,
): string {
  const name = input.classConstructor.name
  if (input.classMeta?.inherit) {
    // @Inherit() present but nothing flowed — name the broken link(s)
    const links = brokenLinksBetween(input.classConstructor, ancestor)
    const brokenBy =
      links.length > 0
        ? `the intermediate class(es) ${links.join(', ')} carry no @Inherit()`
        : 'the inherit chain between them is broken'
    return (
      `[moost] ${name} has @Inherit() but registered 0 route handler(s) while its ancestor ` +
      `${ancestor.name} defines ${count} — @Inherit() bridges one level at a time and ` +
      `${brokenBy}. Add @Inherit() to each intermediate class or re-declare the routes.`
    )
  }
  return (
    `[moost] ${name} extends ${ancestor.name} which defines ${count} route handler(s), ` +
    `but ${name} registered 0 and has no @Inherit() — parent routes are not inherited ` +
    `without it. Add @Inherit() or re-declare the routes.`
  )
}

/**
 * Lost-constructor-params trap: a DI-instantiated class whose effective params
 * metadata is absent while a decorated ancestor declares constructor params.
 * Covers two shapes:
 * - the class carries no Moost metadata at all (undecorated subclass registered
 *   as a controller) — it is not even seen as injectable;
 * - the class is decorated but an undecorated intermediate class breaks the
 *   automatic parent-params fallback (metadata reads walk one level only).
 * An own zero-param constructor emits `params: []` and is a deliberate choice —
 * only truly absent params fire.
 */
function auditLostCtorParams(input: TInheritanceAuditInput): TParamAuditFinding | undefined {
  if (!input.diInstantiated || input.classMeta?.params) {
    return undefined
  }
  const mate = getMoostMate()
  for (const ancestor of ancestorsOf(input.classConstructor)) {
    const count = mate.read(ancestor)?.params?.length ?? 0
    if (count > 0) {
      return { severity: 'warn-only', message: lostCtorParamsMessage(input, ancestor, count) }
    }
  }
  return undefined
}

function lostCtorParamsMessage(
  input: TInheritanceAuditInput,
  ancestor: TClassConstructor,
  count: number,
): string {
  const name = input.classConstructor.name
  if (input.classMeta) {
    // a decorated class with absent params is always the broken-fallback (gap)
    // shape — a decorated direct subclass without an own ctor gets the parent's
    // params automatically, so @Inherit() on the class itself would fix nothing
    const links = brokenLinksBetween(input.classConstructor, ancestor)
    const intermediates = links.length > 0 ? ` (${links.join(', ')})` : ''
    return (
      `[moost] ${name} has no constructor param metadata, but its ancestor ${ancestor.name} ` +
      `declares ${count} constructor param(s) — the inherited constructor would be invoked ` +
      `with zero resolved arguments (dependencies undefined). The parent-params fallback ` +
      `crosses one level at a time: add @Inherit() to the intermediate class(es)${intermediates} ` +
      `or re-declare the constructor with its param decorators.`
    )
  }
  return (
    `[moost] ${name} extends ${ancestor.name} whose constructor declares ${count} DI ` +
    `param(s), but ${name} carries no Moost metadata of its own — it is not seen as ` +
    `injectable and the constructor params will not resolve. Add @Inherit() to ${name} ` +
    `or re-declare the constructor.`
  )
}

/**
 * Bind-time inheritance audit (IMPROVEMENTS.md §3): detects the two real traps
 * of subclassing decorated classes — parent routes silently dropping without a
 * working `@Inherit()` bridge, and parent constructor params silently not
 * resolving. Pure and warn-only: findings join the D1 collector and
 * `Moost.init()` logs them as warnings (they never reject `init()`).
 */
export function auditInheritance(input: TInheritanceAuditInput): TParamAuditFinding[] {
  return [auditRouteDrop(input), auditLostCtorParams(input)].filter((f) => f !== undefined)
}
