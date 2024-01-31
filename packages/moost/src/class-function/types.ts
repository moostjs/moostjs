import type { TAny, TAnyFn } from 'common'

export interface TClassFunction<T extends TAnyFn = TAnyFn> {
  handler: T
}

export type TClassFunctionConstructor<T extends TAnyFn = TAnyFn> = new (
  ...a: TAny[]
) => TClassFunction<T>

export type TCallableClassFunction<T extends TAnyFn = TAnyFn> = T | TClassFunctionConstructor
