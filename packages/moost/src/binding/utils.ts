import { getConstructor } from '@prostojs/mate'
import type { TAny, TClassConstructor } from 'common'

export function getInstanceOwnMethods<T = TAny>(instance: T): Array<keyof T> {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const proto = Object.getPrototypeOf(instance)
  return [
    ...getParentProps(getConstructor(instance) as TClassConstructor), // Inheritance support
    ...Object.getOwnPropertyNames(proto),
    ...Object.getOwnPropertyNames(instance),
  ].filter(m => typeof instance[m as keyof typeof instance] === 'function') as Array<keyof T>
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
