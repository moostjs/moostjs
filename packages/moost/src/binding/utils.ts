import { TAny } from '../types'

export function getInstanceOwnMethods<T = TAny>(instance: T): (keyof T)[] {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const proto = Object.getPrototypeOf(instance)
    return [
        ...Object.getOwnPropertyNames(proto),
        ...Object.getOwnPropertyNames(instance),
    ].filter(m => typeof instance[m as keyof typeof instance] === 'function') as (keyof T)[]
}
