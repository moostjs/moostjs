/* eslint-disable @typescript-eslint/ban-types */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/**
 * Creates an adapter detector for a specific adapter type.
 * @param adapter
 * @param onInit
 * @returns
 */
export function createAdapterDetector(
  adapter: 'http' | 'wf' | 'cli',
  onInit?: (constructor: new (...args: any[]) => unknown) => void
) {
  return {
    detected: false,
    regex: new RegExp(`from\\s+["'](@moostjs\\/event-${adapter})["']`),
    constructor: null as (new (...args: any[]) => unknown) | null,
    async init() {
      this.detected = true
      // @ts-expect-error
      const module = await import(`@moostjs/event-${adapter}`)
      this.constructor = module[`Moost${adapter.charAt(0).toUpperCase() + adapter.slice(1)}`]
      if (onInit) {
        onInit(this.constructor!)
      }
    },
    compare(c: (new (...args: any[]) => unknown) | Function) {
      if (this.detected && this.constructor) {
        return (
          this.constructor === c ||
          c instanceof this.constructor ||
          c.prototype instanceof this.constructor
        )
      }
      return false
    },
  }
}
