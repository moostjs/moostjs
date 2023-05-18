import { getMoostMate } from 'moost'

export interface TCliClassMeta {
    cliParamKeys: string[]
    cliAliases: string[]
}

export function getCliMate() {
    return getMoostMate<TCliClassMeta, TCliClassMeta, TCliClassMeta>()
}
