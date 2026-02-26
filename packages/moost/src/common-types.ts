/** Escape-hatch type alias for `any`. */
export type TAny = any

/** Generic function signature accepting any arguments. */
export type TAnyFn = (...a: TAny[]) => unknown

/** Alias for `object`. */
export type TObject = object

/** Alias for `Function`. */
export type TFunction = Function

/** Generic class constructor type. */
export type TClassConstructor<T = unknown> = new (...args: TAny[]) => T

/** Empty object interface used as a default generic constraint. */
export interface TEmpty {}

/** Union of primitive type name strings (mirrors `typeof` results). */
export type TPrimitives = 'undefined' | 'boolean' | 'number' | 'bigint' | 'string' | 'symbol'

/** Minimal logger interface required by Moost internals. */
export interface TLogger {
  error: (...args: unknown[]) => void
  warn: (...args: unknown[]) => void
  log: (...args: unknown[]) => void
  info: (...args: unknown[]) => void
}
