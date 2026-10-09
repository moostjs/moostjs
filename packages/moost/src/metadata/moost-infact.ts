import { Infact } from '@prostojs/infact'

import { syncEventScope } from '../event-scope'
import type { TPipeData } from '../pipes'
import type { TMoostMetadata, TMoostParamsMetadata } from './moost-metadata'

/** Infact `customData` of a moost resolution: the pipes its params and props resolve through. */
export interface TMoostInfactCustom {
  pipes?: TPipeData[]
}

/**
 * The moost DI container. A direct scope (un)registration of the current event's own scope
 * keeps its on-demand registration state in step (see `syncEventScope`).
 */
export class MoostInfact extends Infact<
  TMoostMetadata,
  TMoostMetadata,
  TMoostParamsMetadata,
  TMoostInfactCustom
> {
  override registerScope(scopeId: string | symbol) {
    super.registerScope(scopeId)
    syncEventScope(scopeId, true)
  }

  override unregisterScope(scopeId: string | symbol) {
    super.unregisterScope(scopeId)
    syncEventScope(scopeId, false)
  }
}
