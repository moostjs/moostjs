import { getMoostMate } from '../metadata'

/**
 * ## Label
 * ### @Decorator
 * _Common purpose decorator that may be used by various adapters for various purposes_
 *
 * Stores Label metadata
 */
export function Label(value: string) {
  return getMoostMate().decorate('label', value)
}

/**
 * ## Description
 * ### @Decorator
 * _Common purpose decorator that may be used by various adapters for various purposes_
 *
 * Stores Description metadata
 */
export function Description(value: string) {
  return getMoostMate().decorate('description', value)
}

/**
 * ## Value
 * ### @Decorator
 * _Common purpose decorator that may be used by various adapters for various purposes_
 *
 * Stores Value metadata
 */
export function Value(value: unknown) {
  return getMoostMate().decorate('value', value)
}

/**
 * ## Id
 * ### @Decorator
 * _Common purpose decorator that may be used by various adapters for various purposes_
 *
 * Stores Id metadata
 */
export function Id(value: string) {
  return getMoostMate().decorate('id', value)
}

/**
 * ## Optional
 * ### @Decorator
 * _Common purpose decorator that may be used by various adapters for various purposes_
 *
 * Stores Optional metadata
 */
export function Optional() {
  return getMoostMate().decorate('optional', true)
}

/**
 * ## Required
 * ### @Decorator
 * _Common purpose decorator that may be used by various adapters for various purposes_
 *
 * Stores Required metadata
 */
export function Required() {
  const mate = getMoostMate()
  return mate.apply(
    mate.decorate('required', true),
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    mate.decorateClass((meta, level, key, index) => {
      if (typeof index !== 'number' && meta && ['string', 'symbol'].includes(typeof key)) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        meta.requiredProps = meta.requiredProps || []
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        meta.requiredProps.push(key as string)
      }
      return meta
    })
  )
}
