export * from './decorators'
export * from './event-wf'
export type { TFlowOutput, TWorkflowSchema } from '@prostojs/wf'
export { StepRetriableError } from '@prostojs/wf'
export { useWfState, wfKind } from '@wooksjs/event-wf'

// Outlet orchestration (from @wooksjs/event-wf)
export {
  handleWfOutletRequest,
  createOutletHandler,
  createHttpOutlet,
  createEmailOutlet,
  useWfOutlet,
  useWfFinished,
} from '@wooksjs/event-wf'
export type {
  WfOutletTriggerConfig,
  WfOutletTriggerDeps,
  WfOutletTokenConfig,
  WfFinishedResponse,
} from '@wooksjs/event-wf'

// Outlet primitives (from @prostojs/wf/outlets)
export {
  outlet,
  outletHttp,
  outletEmail,
  EncapsulatedStateStrategy,
  HandleStateStrategy,
  WfStateStoreMemory,
} from '@prostojs/wf/outlets'
export type {
  WfOutlet,
  WfOutletRequest,
  WfOutletResult,
  WfState,
  WfStateStrategy,
  WfStateStore,
} from '@prostojs/wf/outlets'
