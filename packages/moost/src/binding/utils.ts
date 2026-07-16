import { getConstructor } from '@prostojs/mate'

import type { TAny, TClassConstructor } from '../common-types'

/** Returns the own method names of an instance, including inherited methods from parent classes. */
export function getInstanceOwnMethods<T = TAny>(instance: T): (keyof T)[] {
  const proto = Object.getPrototypeOf(instance)
  return [
    ...new Set([
      ...getParentProps(getConstructor(instance) as TClassConstructor), // Inheritance support
      ...Object.getOwnPropertyNames(proto),
      ...Object.getOwnPropertyNames(instance),
    ]),
  ].filter((m) => typeof instance[m as keyof typeof instance] === 'function') as (keyof T)[]
}

/** Returns the own non-method property names of an instance, including inherited properties. */
export function getInstanceOwnProps<T = TAny>(instance: T): (keyof T)[] {
  const proto = Object.getPrototypeOf(instance)
  return [
    ...new Set([
      ...getParentProps(getConstructor(instance) as TClassConstructor), // Inheritance support
      ...Object.getOwnPropertyNames(proto),
      ...Object.getOwnPropertyNames(instance),
    ]),
  ].filter((m) => typeof instance[m as keyof typeof instance] !== 'function') as (keyof T)[]
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

function getParentProps(constructor: TClassConstructor): string[] {
  const props: string[] = []
  for (const parent of ancestorsOf(constructor)) {
    // deepest ancestor's props first, matching subclass-overrides-parent order
    props.unshift(...Object.getOwnPropertyNames(parent.prototype))
  }
  return props
}
