/**
 * Static key an adapter class names itself under, independently of its class
 * identity — e.g. `static readonly [MOOST_ADAPTER_BRAND] = '@moostjs/event-http/MoostHttp'`.
 *
 * DI keys classes by identity. When two copies of an adapter package are loaded
 * (a dev server evaluating one copy while Node loads another for an externalized
 * dependency, or a bundle next to an external), a library resolving the adapter
 * with `useControllerContext().instantiate(MoostHttp)` holds the *other* copy's
 * class and finds nothing. With a brand, `instantiate()` still returns the
 * attached adapter (and warns once about the duplicate copy).
 */
export const MOOST_ADAPTER_BRAND: unique symbol = Symbol.for('moost:adapter-brand')

/** The {@link MOOST_ADAPTER_BRAND} of a class (inherited by subclasses), if it carries one. */
export function getAdapterBrand(classConstructor: unknown): string | undefined {
  if (typeof classConstructor !== 'function') {
    return undefined
  }
  const brand = (classConstructor as unknown as Record<symbol, unknown>)[MOOST_ADAPTER_BRAND]
  return typeof brand === 'string' ? brand : undefined
}

/**
 * Provide-registry token `Moost.init()` files a branded adapter under next to its
 * class — the lookup `instantiate()` uses for an adapter class that is not the
 * attached one (another package copy, or a base class of the attached adapter).
 */
export function adapterProvideToken(brand: string): string {
  return `moost:adapter:${brand}`
}
