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

export type TPrimitives = 'undefined' | 'boolean' | 'number' | 'bigint' | 'string' | 'symbol'

export type TLogger = { error: (...args: unknown[]) => void, warn: (...args: unknown[]) => void, log: (...args: unknown[]) => void, info: (...args: unknown[]) => void }
