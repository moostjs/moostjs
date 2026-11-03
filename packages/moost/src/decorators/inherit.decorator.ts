import { getMoostMate } from '../metadata'

/**
 * ## Inherit
 * ### @Decorator
 * Enables metadata inheritance from the super class. Goes on the **inheriting
 * subclass** (the class whose metadata is being read), not on the base class.
 *
 * - On a class: class-level metadata is merged from the parent (own keys win),
 *   and every method/prop inherits the parent's metadata — including decorated
 *   overrides, which merge the parent's metadata under their own (so adding
 *   e.g. a rate-limit decorator to an override does not unbind the parent's
 *   `@Get`/`@Post` route).
 * - Exception to "own keys win" (since 0.7.2): interceptors (incl.
 *   `@Authenticate` guards), pipes and prop decorators ACCUMULATE on the class
 *   and on overridden methods, parent first. The same interceptor/pipe
 *   *reference* on both levels runs once; a factory called on each level runs
 *   twice. A subclass can't remove a base class's class-level interceptors.
 *   Routes, params and `@ImportController` still replace.
 * - On a method/prop: enables inheritance for just that member.
 * - `@Inherit(false)` on an overridden member opts out of the merge for a
 *   deliberate full replacement (the member keeps only its own metadata).
 *
 * Note: constructor param metadata is inherited automatically when the
 * subclass declares no constructor of its own; a subclass that declares a
 * constructor uses its own params only.
 */
export const Inherit = (inherit = true) => getMoostMate().decorate('inherit', inherit)
