import { getMoostMate, type TMoostMetadata, type Mate, type TMateParamMeta } from 'moost'

export interface TCliClassMeta {
  cliOptionsKeys?: string[]
  cliAliases?: string[]
  cliExamples?: Array<{ cmd: string; description?: string }>
  cliOptions?: Array<{ keys: string[]; description?: string; value?: string }>
  params?: TCliClassMeta[]
  // cliHelpUsed?: boolean
}

export function getCliMate(): Mate<
  TMoostMetadata &
    TCliClassMeta & {
      params: Array<TMateParamMeta>
    },
  TMoostMetadata &
    TCliClassMeta & {
      params: Array<TMateParamMeta>
    }
> {
  return getMoostMate<TCliClassMeta, TCliClassMeta>()
}
