import { getMoostMate } from 'moost'

export interface TCliClassMeta {
    cliParams: { keys: string | [string, string], descr?: string }[]
}

export function getCliMate() {
    return getMoostMate<TCliClassMeta, TCliClassMeta, TCliClassMeta>()
}
