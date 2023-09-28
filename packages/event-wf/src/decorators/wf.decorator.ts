import { TWorkflowSchema } from '@prostojs/wf'
import { getWfMate } from '../meta-types'
import { Resolve } from 'moost'
import { useWfState } from '@wooksjs/event-wf'

export function WStep(path?: string): MethodDecorator {
    return getWfMate().decorate('handlers', { path, type: 'WF_STEP' }, true)
}

export function WFlow(path?: string): MethodDecorator {
    return getWfMate().decorate('handlers', { path, type: 'WF_FLOW' }, true)
}

export function WSchema<T>(schema: TWorkflowSchema<T>): MethodDecorator {
    return getWfMate().decorate('wfSchema', schema)
}

export const WfCtx = (name?: string) => Resolve(() => {
    const c = useWfState().ctx<Record<string, unknown>>()
    return name ? c[name] : c
}, name || 'WfCtx')

export const WfResume = () => Resolve(() => useWfState().resume)

export const WfIndexes = () => Resolve(() => useWfState().indexes)

export const WfSchemaId = () => Resolve(() => useWfState().schemaId)

export const WfInput = (name?: string) => Resolve(() => {
    const i = useWfState().input() as Record<string, unknown>
    return typeof i !== 'undefined' ? (name ? i[name] : i) : undefined
}, name || 'WfInput')
