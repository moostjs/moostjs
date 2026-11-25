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
  /** Names of the methods that bound at least one handler (post-inheritance). */
  boundMethods: ReadonlySet<string>
  /** True when the class was registered as a constructor — DI will instantiate it. */
  diInstantiated: boolean
}

/**
 * Route methods of the ancestors, closest first, each with the closest ancestor that declares
 * handlers on it. The walk ends at an ancestor with a class-level `@Inherit(false)`: it replaced
 * whatever its own ancestors declared on purpose.
 */
function ancestorRoutes(classConstructor: TClassConstructor): Map<string, TClassConstructor> {
  const mate = getMoostMate()
  const routes = new Map<string, TClassConstructor>()
  for (const ancestor of ancestorsOf(classConstructor)) {
    for (const name of Object.getOwnPropertyNames(ancestor.prototype as object)) {
      if (
        name !== 'constructor' &&
        !routes.has(name) &&
        mate.read(ancestor, name)?.handlers?.length
      ) {
        routes.set(name, ancestor)
      }
    }
    if (mate.read(ancestor)?.inherit === false) {
      break
    }
  }
  return routes
}

/**
 * Whether a member-level `@Inherit(false)` between the class and `definer` drops the route on
 * purpose (the registered class itself included, `definer` excluded).
 */
function droppedOnPurpose(
  classConstructor: TClassConstructor,
  name: string,
  definer: TClassConstructor,
): boolean {
  const mate = getMoostMate()
  for (const cls of [classConstructor, ...ancestorsOf(classConstructor)]) {
    if (cls === definer) {
      return false
    }
    if (mate.read(cls, name)?.inherit === false) {
      return true
    }
  }
  return false
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

/*
 * Bind-time inheritance audit: the two real traps of subclassing decorated classes — parent
 * routes silently dropping without a working `@Inherit()` bridge (`auditRouteDrop`, once the
 * handlers are bound), and parent constructor params silently not resolving
 * (`auditLostCtorParams`, before the class is instantiated). Pure and warn-only: findings join
 * the param-audit findings and `Moost.init()` logs them as warnings (they never reject `init()`).
 */

/**
 * Route-drop trap: an ancestor's route method that the registered class
 * neither binds nor drops on purpose silently 404s. Fires when the class
 * carries no `@Inherit` decision (routes never flow by default) — also when it
 * re-declares some of the routes — AND when it carries `@Inherit()` but routes
 * did not flow (a bridge broken by intermediate classes without `@Inherit()` of
 * their own). A class-level `@Inherit(false)` and a member-level
 * `@Inherit(false)` on an override are deliberate drops and stay silent.
 */
export function auditRouteDrop(input: TInheritanceAuditInput): TParamAuditFinding | undefined {
  if (input.classMeta?.inherit === false) {
    return undefined
  }
  const missing: string[] = []
  // routes come closest first, so the last missing one is the farthest ancestor's
  let farthest: TClassConstructor | undefined
  for (const [name, definer] of ancestorRoutes(input.classConstructor)) {
    if (input.boundMethods.has(name) || droppedOnPurpose(input.classConstructor, name, definer)) {
      continue
    }
    missing.push(`${definer.name}.${name}()`)
    farthest = definer
  }
  if (!farthest) {
    return undefined
  }
  return { severity: 'warn-only', message: routeDropMessage(input, missing, farthest) }
}

function routeDropMessage(
  input: TInheritanceAuditInput,
  missing: string[],
  farthest: TClassConstructor,
): string {
  const name = input.classConstructor.name
  const routes = missing.join(', ')
  if (input.classMeta?.inherit) {
    // @Inherit() present but routes did not flow — name the broken link(s)
    const links = brokenLinksBetween(input.classConstructor, farthest)
    const brokenBy =
      links.length > 0
        ? `the intermediate class(es) ${links.join(', ')} carry no @Inherit()`
        : 'the inherit chain between them is broken'
    return (
      `[moost] ${name} has @Inherit() but does not bind the inherited route handler(s) ` +
      `${routes} — @Inherit() bridges one level at a time and ${brokenBy}. ` +
      `Add @Inherit() to each intermediate class or re-declare the routes.`
    )
  }
  return (
    `[moost] ${name} does not bind the route handler(s) ${routes} of its ancestor(s) ` +
    `and has no @Inherit() — parent routes are not inherited without it. Add @Inherit() ` +
    `or re-declare the routes; to drop them on purpose, mark the class @Inherit(false) ` +
    `(or an overriding method, for one route).`
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
export function auditLostCtorParams(
  input: Omit<TInheritanceAuditInput, 'boundMethods'>,
): TParamAuditFinding | undefined {
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
  input: Omit<TInheritanceAuditInput, 'boundMethods'>,
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
