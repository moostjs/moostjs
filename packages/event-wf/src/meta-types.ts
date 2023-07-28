
import { getMoostMate } from 'moost'
import { TWorkflowSchema } from '@wooksjs/event-wf'

export interface TWfClassMeta {
    wfSchema: TWorkflowSchema<any>
    params: TWfClassMeta[]
}

export function getWfMate() {
    return getMoostMate<TWfClassMeta, TWfClassMeta>()
}
