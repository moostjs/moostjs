import type { TWorkflowSchema } from '@wooksjs/event-wf'
import { getMoostMate, type TMoostMetadata, type Mate, type TMateParamMeta } from 'moost'

export interface TWfClassMeta {
  wfSchema: TWorkflowSchema<any>
  params: TWfClassMeta[]
}

export function getWfMate(): Mate<
  TMoostMetadata &
    TWfClassMeta & {
      params: Array<TMateParamMeta>
    },
  TMoostMetadata &
    TWfClassMeta & {
      params: Array<TMateParamMeta>
    }
> {
  return getMoostMate<TWfClassMeta, TWfClassMeta>()
}
