import { TWorkflowSchema } from '@prostojs/wf'
import { getWfMate } from '../meta-types'

export function WfStep(path?: string): MethodDecorator {
    return getWfMate().decorate('handlers', { path, type: 'WF_STEP' }, true)
}

export function WfFlow(path?: string): MethodDecorator {
    return getWfMate().decorate('handlers', { path, type: 'WF_STEP' }, true)
}

export function WfSchema<T>(schema: TWorkflowSchema<T>): MethodDecorator {
    return getWfMate().decorate('wfSchema', schema)
}
