import type { TWorkflowSchema } from '@wooksjs/event-wf'
import { getMoostMate } from 'moost'

export interface TWfClassMeta {
  wfSchema: TWorkflowSchema<any>
  params: TWfClassMeta[]
}

export function getWfMate() {
  return getMoostMate<TWfClassMeta, TWfClassMeta>()
}
