import type { TWorkflowSchema } from '@prostojs/wf'
import { useWfState } from '@wooksjs/event-wf'
import { Resolve } from 'moost'

import { getWfMate } from '../meta-types'

/**
 * Registers a method as a workflow step handler.
 *
 * @param path - Step identifier used in workflow schemas. Defaults to the method name.
 *
 * @example
 * ```ts
 * @Step('validate')
 * validateInput(@WorkflowParam('input') data: unknown) {
 *   return schema.parse(data)
 * }
 * ```
 */
export function Step(path?: string): MethodDecorator {
  return getWfMate().decorate('handlers', { path, type: 'WF_STEP' }, true)
}

/**
 * Registers a method as a workflow flow entry point.
 * Use with `@WorkflowSchema` to define the step sequence.
 *
 * @param path - Workflow identifier. Defaults to the method name.
 *
 * @example
 * ```ts
 * @Workflow('onboarding')
 * @WorkflowSchema([{ step: 'validate' }, { step: 'save' }])
 * onboarding() {}
 * ```
 */
export function Workflow(path?: string): MethodDecorator {
  return getWfMate().decorate('handlers', { path, type: 'WF_FLOW' }, true)
}

/**
 * Attaches a workflow schema (step sequence) to a `@Workflow` method.
 *
 * @param schema - Array of step definitions composing the workflow.
 */
export function WorkflowSchema<T>(schema: TWorkflowSchema<T>): MethodDecorator {
  return getWfMate().decorate('wfSchema', schema)
}

/**
 * Parameter decorator that resolves a workflow context value into a step handler argument.
 *
 * @param name - The workflow value to resolve:
 *   - `'state'` — Full workflow state object
 *   - `'resume'` — Whether the workflow is being resumed
 *   - `'indexes'` — Current step indexes
 *   - `'schemaId'` — Active workflow schema identifier
 *   - `'stepId'` — Current step identifier
 *   - `'context'` — Workflow context data
 *   - `'input'` — Input passed to `start()` or `resume()`
 *
 * @example
 * ```ts
 * @Step('process')
 * handle(@WorkflowParam('input') data: string, @WorkflowParam('context') ctx: MyCtx) { }
 * ```
 */
export const WorkflowParam = (
  name: 'resume' | 'indexes' | 'schemaId' | 'stepId' | 'context' | 'input' | 'state',
) => {
  switch (name) {
    case 'state': {
      return Resolve(() => useWfState(), 'Workflow-State')
    }
    case 'resume': {
      return Resolve(() => useWfState().resume, 'Workflow-Resume')
    }
    case 'indexes': {
      return Resolve(() => useWfState().indexes, 'Workflow-Indexes')
    }
    case 'schemaId': {
      return Resolve(() => useWfState().schemaId, 'Workflow-SchemaId')
    }
    case 'stepId': {
      return Resolve(() => useWfState().stepId(), 'Workflow-StepId')
    }
    case 'context': {
      return Resolve(() => useWfState().ctx<Record<string, unknown>>(), 'Workflow-Context')
    }
    case 'input': {
      return Resolve(() => useWfState().input()!, 'Workflow-Input')
    }
  }
}
