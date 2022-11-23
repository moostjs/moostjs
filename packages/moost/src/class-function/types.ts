import { TAny, TAnyFn } from '../types'

export interface TClassFunction<T extends TAnyFn = TAnyFn> {
    handler: T
}

export interface TClassFunctionConstructor<T extends TAnyFn = TAnyFn> {
    new (...a: TAny[]): TClassFunction<T>
}

export type TCallableClassFunction<T extends TAnyFn = TAnyFn> = T | TClassFunctionConstructor
