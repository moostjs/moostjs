import type { TWorkflowSchema } from '@wooksjs/event-wf'
import { getMoostMate } from 'moost'
import type { TMoostMetadata, Mate, TMateParamMeta } from 'moost'

export interface TWfClassMeta {
  wfSchema: TWorkflowSchema<any>
  params: TWfClassMeta[]
}

export function getWfMate(): Mate<
  TMoostMetadata &
    TWfClassMeta & {
      params: TMateParamMeta[]
    },
  TMoostMetadata &
    TWfClassMeta & {
      params: TMateParamMeta[]
    }
> {
  return getMoostMate<TWfClassMeta, TWfClassMeta>()
}
