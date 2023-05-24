import { getMoostMate } from 'moost'

export interface TCliClassMeta {
    cliOptionsKeys: string[]
    cliAliases: string[]
    cliExamples: { cmd: string, description?: string }[]
    cliOptions: { keys: string[], description?: string, value?: string }[]
    // cliHelpUsed?: boolean
}

export function getCliMate() {
    return getMoostMate<TCliClassMeta, TCliClassMeta, TCliClassMeta>()
}
