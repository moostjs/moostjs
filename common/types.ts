/* eslint-disable @typescript-eslint/ban-types */
/* eslint-disable @typescript-eslint/no-explicit-any */
export type TAny = any
export type TAnyFn = {
    (...a: TAny[]): unknown
}
export type TObject = object
export type TFunction = Function
export type TClassConstructor<T = unknown> = new (...args: TAny[]) => T

export interface TEmpty {}
