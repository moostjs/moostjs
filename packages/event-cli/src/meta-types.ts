import { getMoostMate } from 'moost'

export interface TCliClassMeta {
  cliOptionsKeys: string[]
  cliAliases: string[]
  cliExamples: Array<{ cmd: string; description?: string }>
  cliOptions: Array<{ keys: string[]; description?: string; value?: string }>
  params: TCliClassMeta[]
  // cliHelpUsed?: boolean
}

export function getCliMate() {
  return getMoostMate<TCliClassMeta, TCliClassMeta>()
}
