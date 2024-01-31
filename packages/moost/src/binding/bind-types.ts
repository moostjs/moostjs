import type { TConsoleBase } from '@prostojs/logger'
import type { TAny, TClassConstructor, TObject } from 'common'

import type { TMoostMetadata } from '../metadata'
import type { TMoostAdapter } from '../moost'
import type { TPipeData } from '../pipes'

export interface TBindControllerOptions {
  getInstance: () => Promise<TObject>
  classConstructor: TClassConstructor
  adapters: Array<TMoostAdapter<TAny>>
  globalPrefix?: string
  replaceOwnPrefix?: string
  provide?: TMoostMetadata['provide']
  interceptors?: TMoostMetadata['interceptors']
  pipes?: TPipeData[]
  logger: TConsoleBase
}
