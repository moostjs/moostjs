import { getConstructor } from '@prostojs/mate'

import type { TAny, TClassConstructor } from '../common-types'

/** Returns the own method names of an instance, including inherited methods from parent classes. */
export function getInstanceOwnMethods<T = TAny>(instance: T): (keyof T)[] {
  const proto = Object.getPrototypeOf(instance)
  return [...new Set([
    ...getParentProps(getConstructor(instance) as TClassConstructor), // Inheritance support
    ...Object.getOwnPropertyNames(proto),
    ...Object.getOwnPropertyNames(instance),
  ])].filter((m) => typeof instance[m as keyof typeof instance] === 'function') as (keyof T)[]
}

/** Returns the own non-method property names of an instance, including inherited properties. */
export function getInstanceOwnProps<T = TAny>(instance: T): (keyof T)[] {
  const proto = Object.getPrototypeOf(instance)
  return [...new Set([
    ...getParentProps(getConstructor(instance) as TClassConstructor), // Inheritance support
    ...Object.getOwnPropertyNames(proto),
    ...Object.getOwnPropertyNames(instance),
  ])].filter((m) => typeof instance[m as keyof typeof instance] !== 'function') as (keyof T)[]
}

const fnProto = Object.getPrototypeOf(Function) as TClassConstructor

function getParentProps(constructor: TClassConstructor): string[] {
  const parent = Object.getPrototypeOf(constructor) as TClassConstructor
  if (
    typeof parent === 'function' &&
    parent !== fnProto &&
    parent !== constructor &&
    parent.prototype
  ) {
    return [...getParentProps(parent), ...Object.getOwnPropertyNames(parent.prototype)]
  }
  return []
}
