/* eslint-disable @typescript-eslint/naming-convention */
import { z } from 'zod'

import type { TFunction, TPrimitives } from './common-types'

export const primitivesConstructorMap = new WeakMap<
  TFunction['prototype'],
  (opts?: TZodOpts) => z.ZodType
>()
primitivesConstructorMap.set(String, (opts?: TZodOpts) => z.string(opts))
primitivesConstructorMap.set(Number, (opts?: TZodOpts) => z.number(opts))
primitivesConstructorMap.set(Boolean, (opts?: TZodOpts) => z.boolean(opts))
primitivesConstructorMap.set(Array, (opts?: TZodOpts) => z.array(z.unknown(), opts))
primitivesConstructorMap.set(Date, (opts?: TZodOpts) => z.array(z.date(), opts))
primitivesConstructorMap.set(Object, (opts?: TZodOpts) => z.any(opts))
primitivesConstructorMap.set(Set, (opts?: TZodOpts) => z.any(opts))
primitivesConstructorMap.set(Map, (opts?: TZodOpts) => z.any(opts))
primitivesConstructorMap.set(Promise, (opts?: TZodOpts) => z.any(opts))
primitivesConstructorMap.set(Function, (opts?: TZodOpts) => z.any(opts))
// typeConstructorMap.set(Set, z.)
// typeConstructorMap.set(Map, z.)
// typeConstructorMap.set(Promise, z.)
// typeConstructorMap.set(Function, z.)

export const primitivesMap = new Map<string, (opts?: TZodOpts) => z.ZodType>()

primitivesMap.set('undefined', (opts?: TZodOpts) => z.undefined(opts))
primitivesMap.set('boolean', (opts?: TZodOpts) => z.boolean(opts))
primitivesMap.set('number', (opts?: TZodOpts) => z.number(opts))
primitivesMap.set('bigint', (opts?: TZodOpts) => z.bigint(opts))
primitivesMap.set('string', (opts?: TZodOpts) => z.string(opts))
primitivesMap.set('symbol', (opts?: TZodOpts) => z.symbol(opts))

export interface TZodOpts {
  coerce?: true | undefined
  errorMap?: z.ZodErrorMap
  invalid_type_error?: string
  required_error?: string
}

export function resolveZodPrimitive(from: TPrimitives, opts?: TZodOpts): z.ZodType {
  const zodFactory = primitivesMap.get(from)
  if (zodFactory) {
    return zodFactory(opts)
  }
  throw new Error(`Could not retrieve ZodType for type "${from}".`)
}

export function resolveZodPrimitiveByConstructor(type: TFunction, opts?: TZodOpts) {
  const factory = primitivesConstructorMap.get(type)
  if (factory) {
    return factory(opts)
  }
}
