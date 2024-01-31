import type { TWorkflowSchema } from '@prostojs/wf'
import { useWfState } from '@wooksjs/event-wf'
import { Resolve } from 'moost'

import { getWfMate } from '../meta-types'

export function Step(path?: string): MethodDecorator {
  return getWfMate().decorate('handlers', { path, type: 'WF_STEP' }, true)
}

export function Workflow(path?: string): MethodDecorator {
  return getWfMate().decorate('handlers', { path, type: 'WF_FLOW' }, true)
}

export function WorkflowSchema<T>(schema: TWorkflowSchema<T>): MethodDecorator {
  return getWfMate().decorate('wfSchema', schema)
}

export const WorkflowParam = (name: 'resume' | 'indexes' | 'schemaId' | 'context' | 'input') => {
  switch (name) {
    case 'resume': {
      return Resolve(() => useWfState().resume, 'Workflow-Resume')
    }
    case 'indexes': {
      return Resolve(() => useWfState().indexes, 'Workflow-Indexes')
    }
    case 'schemaId': {
      return Resolve(() => useWfState().schemaId, 'Workflow-SchemaId')
    }
    case 'context': {
      return Resolve(() => useWfState().ctx<Record<string, unknown>>(), 'Workflow-Context')
    }
    case 'input': {
      return Resolve(() => useWfState().input()!, 'Workflow-Input')
    }
  }
}
