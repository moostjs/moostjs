import { getLogger } from './utils'

/** Id prefix of the virtual modules re-exporting an adapter package (`virtual:moost-adapter/http`). */
export const ADAPTER_VIRTUAL_PREFIX = 'virtual:moost-adapter/'

/** Source of a resolved (`\0`-prefixed) adapter virtual module, or `undefined` for any other id. */
export function loadAdapterVirtualModule(id: string): string | undefined {
  if (!id.startsWith(`\0${ADAPTER_VIRTUAL_PREFIX}`)) {
    return undefined
  }
  const adapter = id.slice(ADAPTER_VIRTUAL_PREFIX.length + 1)
  return `export * from ${JSON.stringify(`@moostjs/event-${adapter}`)}\n`
}

/**
 * Creates an adapter detector for a specific adapter type.
 * @param adapter
 * @param onInit
 * @returns
 */
export function createAdapterDetector(
  adapter: 'http' | 'wf' | 'cli',
  onInit?: (
    constructor: new (...args: any[]) => unknown,
    moduleExports: Record<string, any>,
  ) => void,
) {
  return {
    detected: false,
    regex: new RegExp(`from\\s+["'](@moostjs\\/event-${adapter})["']`),
    constructor: null as (new (...args: any[]) => unknown) | null,
    ssrLoadModule: null as ((id: string) => Promise<Record<string, any>>) | null,
    async init() {
      this.detected = true
      const moduleId = `@moostjs/event-${adapter}`
      // Through a module re-exporting the package: the SSR module runner treats a
      // top-level `runner.import('@moostjs/event-http')` (no importer) as an app
      // module and evaluates its own copy, while the same bare import in app code —
      // or in any natively loaded dependency — is externalized to Node. The runner
      // then dedupes the app's import onto its copy, so the app would run a
      // `MoostHttp` no externalized dependency can see ("Class is not Injectable").
      // With an importer, the import takes the externalization path app code takes.
      const module = this.ssrLoadModule
        ? await this.ssrLoadModule(`${ADAPTER_VIRTUAL_PREFIX}${adapter}`)
        : await import(moduleId)
      const constructorName = `Moost${adapter.charAt(0).toUpperCase() + adapter.slice(1)}`
      getLogger().log(`🔍 ${__DYE_DIM__}Extracting Adapter "${constructorName}"`)
      this.constructor = module[constructorName]
      if (onInit && this.constructor) {
        onInit(this.constructor!, module)
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
