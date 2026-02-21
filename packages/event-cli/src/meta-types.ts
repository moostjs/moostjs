import { getMoostMate } from 'moost'
import type { TMoostMetadata, Mate, TMateParamMeta } from 'moost'

export interface TCliClassMeta {
  cliOptionsKeys?: string[]
  cliAliases?: string[]
  cliExamples?: { cmd: string; description?: string }[]
  cliOptions?: { keys: string[]; description?: string; value?: string }[]
  params?: TCliClassMeta[]
  // cliHelpUsed?: boolean
}

export function getCliMate(): Mate<
  TMoostMetadata &
    TCliClassMeta & {
      params: TMateParamMeta[]
    },
  TMoostMetadata &
    TCliClassMeta & {
      params: TMateParamMeta[]
    }
> {
  return getMoostMate<TCliClassMeta, TCliClassMeta>()
}
