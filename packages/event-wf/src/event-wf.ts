import type { TFlowOutput, TWorkflowSpy } from '@prostojs/wf'
import { useEventId } from '@wooksjs/event-core'
import type { TStepHandler, TWooksWfOptions } from '@wooksjs/event-wf'
import { createWfApp, WooksWf } from '@wooksjs/event-wf'
import type { Moost, TMoostAdapter, TMoostAdapterOptions } from 'moost'
import { defineMoostEventHandler, getMoostInfact } from 'moost'

import { getWfMate } from './meta-types'

export interface TWfHandlerMeta {
  path: string
}

const LOGGER_TITLE = 'moost-wf'
const CONTEXT_TYPE = 'WF'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class MoostWf<T = any, IR = any> implements TMoostAdapter<TWfHandlerMeta> {
  public readonly name = 'workflow'

  protected wfApp: WooksWf<T, IR>

  constructor(
    protected opts?: WooksWf<T, IR> | TWooksWfOptions,
    private readonly debug?: boolean
  ) {
    if (opts && opts instanceof WooksWf) {
      this.wfApp = opts
    } else if (opts) {
      this.wfApp = createWfApp<T>(opts) as WooksWf<T, IR>
    } else {
      this.wfApp = createWfApp() as WooksWf<T, IR>
    }
  }

  async onNotFound() {
    return defineMoostEventHandler({
      loggerTitle: LOGGER_TITLE,
      getIterceptorHandler: () => this.moost?.getGlobalInterceptorHandler(),
      getControllerInstance: () => this.moost,
      callControllerMethod: () => new Error('WF Handler not found'),
      logErrors: this.debug,
      targetPath: '',
      handlerType: '__SYSTEM__',
    })()
  }

  protected moost?: Moost

  protected toInit: Array<() => void> = []

  onInit(moost: Moost) {
    this.moost = moost
    this.toInit.forEach(fn => {
      fn()
    })
  }

  getWfApp() {
    return this.wfApp
  }

  public attachSpy<I>(fn: TWorkflowSpy<T, I, IR>) {
    return this.wfApp.attachSpy<I>(fn)
  }

  public detachSpy<I>(fn: TWorkflowSpy<T, I, IR>) {
    this.wfApp.detachSpy<I>(fn)
  }

  public start<I>(schemaId: string, initialContext: T, input?: I): Promise<TFlowOutput<T, I, IR>> {
    return this.wfApp.start(
      schemaId,
      initialContext,
      input,
      () => {},
      () => {
        const scopeId = useEventId().getId()
        getMoostInfact().unregisterScope(scopeId)
      }
    )
  }

  public resume<I>(
    state: { schemaId: string; context: T; indexes: number[] },
    input?: I
  ): Promise<TFlowOutput<T, I, IR>> {
    return this.wfApp.resume(
      state,
      input,
      () => {},
      () => {
        const scopeId = useEventId().getId()
        getMoostInfact().unregisterScope(scopeId)
      }
    )
  }

  bindHandler<T extends object = object>(opts: TMoostAdapterOptions<TWfHandlerMeta, T>): void {
    let fn
    for (const handler of opts.handlers) {
      if (!['WF_STEP', 'WF_FLOW'].includes(handler.type)) {
        continue
      }
      const schemaId = handler.path
      const path =
        typeof schemaId === 'string' ? schemaId : typeof opts.method === 'string' ? opts.method : ''
      // eslint-disable-next-line sonarjs/no-nested-template-literals
      const targetPath = `${`${opts.prefix || ''}/${path}`.replace(/\/\/+/g, '/')}${
        path.endsWith('//') ? '/' : ''
      }` // explicit double slash "//" -> force url to end with slash

      fn = defineMoostEventHandler({
        contextType: CONTEXT_TYPE,
        loggerTitle: LOGGER_TITLE,
        getIterceptorHandler: opts.getIterceptorHandler,
        getControllerInstance: opts.getInstance,
        controllerMethod: opts.method,
        resolveArgs: opts.resolveArgs,
        manualUnscope: true,
        targetPath,
        handlerType: handler.type,
      })

      if (handler.type === 'WF_STEP') {
        this.wfApp.step(targetPath, {
          handler: fn as TStepHandler<any, any, any>,
        })
        opts.logHandler(`${__DYE_CYAN__}(${handler.type})${__DYE_GREEN__}${targetPath}`)
      } else {
        const mate = getWfMate()
        let wfSchema = mate.read(opts.fakeInstance, opts.method as string)?.wfSchema
        if (!wfSchema) {
          wfSchema = mate.read(opts.fakeInstance)?.wfSchema
        }
        const _fn = fn as () => void
        // eslint-disable-next-line @typescript-eslint/no-loop-func
        this.toInit.push(() => {
          this.wfApp.flow(targetPath, wfSchema || [], opts.prefix === '/' ? '' : opts.prefix, _fn)
          opts.logHandler(`${__DYE_CYAN__}(${handler.type})${__DYE_GREEN__}${targetPath}`)
        })
      }
    }
  }
}
