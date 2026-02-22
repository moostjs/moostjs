import { getLogger } from './utils'

/**
 * Creates an adapter detector for a specific adapter type.
 * @param adapter
 * @param onInit
 * @returns
 */
export function createAdapterDetector(
  adapter: 'http' | 'wf' | 'cli',
  onInit?: (constructor: new (...args: any[]) => unknown) => void,
) {
  return {
    detected: false,
    regex: new RegExp(`from\\s+["'](@moostjs\\/event-${adapter})["']`),
    constructor: null as (new (...args: any[]) => unknown) | null,
    ssrLoadModule: null as ((id: string) => Promise<Record<string, any>>) | null,
    async init() {
      this.detected = true
      const moduleId = `@moostjs/event-${adapter}`
      const module = this.ssrLoadModule
        ? await this.ssrLoadModule(moduleId)
        : await import(moduleId)
      const constructorName = `Moost${adapter.charAt(0).toUpperCase() + adapter.slice(1)}`
      getLogger().log(`🔍 ${__DYE_DIM__}Extracting Adapter "${constructorName}"`)
      this.constructor = module[constructorName]
      if (onInit && this.constructor) {
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
