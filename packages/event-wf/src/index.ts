export * from './decorators'
export * from './event-wf'
export type { TFlowOutput, TWorkflowSchema } from '@prostojs/wf'
export { StepRetriableError } from '@prostojs/wf'
export { swapStrategy, useWfState, useWfStrategy, wfKind } from '@wooksjs/event-wf'

// Outlet orchestration (from @wooksjs/event-wf)
export {
  handleWfOutletRequest,
  createOutletHandler,
  createHttpOutlet,
  createEmailOutlet,
  mintWfToken,
  normalizeWfId,
  useWfOutlet,
  useWfFinished,
  WF_TRIGGER_ERRORS,
} from '@wooksjs/event-wf'
export type {
  WfMintTokenOptions,
  WfMintTokenResult,
  WfOutletTriggerConfig,
  WfOutletTriggerDeps,
  WfOutletTokenConfig,
  WfFinishedResponse,
  WfPauseRequest,
  WfStartRunner,
  WfTriggerErrorBody,
  WfTriggerErrorCode,
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
