import { CliHelpRenderer } from '@prostojs/cli-help'
import { getMoostMate } from 'moost'
import { TWooksHandler } from 'wooks'

export interface TCliClassMeta {
    cliParamKeys: string[]
    cliAliases: string[]
    cliExamples: { cmd: string, description?: string }[]
    cliOptions: { keys: string[], description?: string, value?: string }[]
    // cliHelpUsed?: boolean
}

export function getCliMate() {
    return getMoostMate<TCliClassMeta, TCliClassMeta, TCliClassMeta>()
}

export type CliHelpRendererWithFn = CliHelpRenderer<{ fn: TWooksHandler, log: ((eventName: string) => void)}>
