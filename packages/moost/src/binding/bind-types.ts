import type { TConsoleBase } from '@prostojs/logger'

import type { TAny, TClassConstructor, TObject } from '../common-types'
import type { TMoostMetadata } from '../metadata'
import type { Moost, TMoostAdapter } from '../moost'
import type { TPipeData } from '../pipes'

export interface TBindControllerOptions {
  getInstance: () => Promise<TObject>
  classConstructor: TClassConstructor
  adapters: TMoostAdapter<TAny>[]
  globalPrefix?: string
  replaceOwnPrefix?: string
  provide?: TMoostMetadata['provide']
  replace?: TMoostMetadata['replace']
  interceptors?: TMoostMetadata['interceptors']
  pipes?: TPipeData[]
  logger: TConsoleBase
  moostInstance: Moost
}
