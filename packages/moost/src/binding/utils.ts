import type { TAny, TClassConstructor } from '../common-types'

/**
 * Returns the own method names of an instance, including inherited methods
 * from parent classes.
 *
 * Classification is descriptor-based and NEVER invokes accessors: a property
 * is a method only when its nearest descriptor is a DATA property holding a
 * function. Accessor properties (get/set) are classified as props, not
 * methods — evaluating `instance[name]` to test them would fire the getter,
 * and getters are allowed to throw (e.g. moost-db's `.table` throws for
 * view-bound controllers), which used to turn a mere method scan into a
 * crash.
 */
export function getInstanceOwnMethods<T = TAny>(instance: T): (keyof T)[] {
  return collectByDescriptor(instance as object, true) as (keyof T)[]
}

/** Returns the own non-method property names of an instance, including inherited properties. Accessor properties are always included (their getters are never invoked — see {@link getInstanceOwnMethods}). */
export function getInstanceOwnProps<T = TAny>(instance: T): (keyof T)[] {
  return collectByDescriptor(instance as object, false) as (keyof T)[]
}

/**
 * Walks the prototype chain (instance own names first, then each prototype up
 * to but excluding `Object.prototype`) and classifies every name by its
 * NEAREST descriptor — matching JS property-resolution order, so an instance
 * field shadowing a prototype method is classified by the instance field.
 */
function collectByDescriptor(instance: object, wantMethods: boolean): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  let obj: object | null = instance
  while (obj && obj !== Object.prototype) {
    for (const name of Object.getOwnPropertyNames(obj)) {
      if (seen.has(name)) {
        continue
      }
      seen.add(name)
      const desc = Object.getOwnPropertyDescriptor(obj, name)!
      if ((typeof desc.value === 'function') === wantMethods) {
        out.push(name)
      }
    }
    obj = Object.getPrototypeOf(obj) as object | null
  }
  return out
}

/**
 * Walks the user-defined ancestor classes of a constructor, closest first.
 * Terminates at `Function.prototype` (it is a function but has no `.prototype`).
 */
export function* ancestorsOf(classConstructor: TClassConstructor): Generator<TClassConstructor> {
  let parent = Object.getPrototypeOf(classConstructor) as TClassConstructor
  while (typeof parent === 'function' && parent.prototype) {
    yield parent
    parent = Object.getPrototypeOf(parent) as TClassConstructor
  }
}
