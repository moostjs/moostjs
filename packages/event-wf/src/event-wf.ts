import type { TFlowOutput, TWorkflowSpy } from '@prostojs/wf'
import { useEventId } from '@wooksjs/event-core'
import type { TStepHandler, TWooksWfOptions } from '@wooksjs/event-wf'
import { createWfApp, WooksWf } from '@wooksjs/event-wf'
import type { Moost, TMoostAdapter, TMoostAdapterOptions } from 'moost'
import { defineMoostEventHandler, getMoostInfact, setControllerContext } from 'moost'

import { getWfMate } from './meta-types'

export interface TWfHandlerMeta {
  path: string
}

const LOGGER_TITLE = 'moost-wf'
const CONTEXT_TYPE = 'WF'

export class MoostWf<T = any, IR = any> implements TMoostAdapter<TWfHandlerMeta> {
  public readonly name = 'workflow'

  protected wfApp: WooksWf<T, IR>

  constructor(
    protected opts?: WooksWf<T, IR> | TWooksWfOptions,
    private readonly debug?: boolean,
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

  protected toInit: (() => void)[] = []

  onInit(moost: Moost) {
    this.moost = moost
    this.toInit.forEach((fn) => {
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
      },
    )
  }

  public resume<I>(
    state: { schemaId: string; context: T; indexes: number[] },
    input?: I,
  ): Promise<TFlowOutput<T, I, IR>> {
    return this.wfApp.resume(
      state,
      input,
      () => {},
      () => {
        const scopeId = useEventId().getId()
        getMoostInfact().unregisterScope(scopeId)
      },
    )
  }

  bindHandler<T extends object = object>(opts: TMoostAdapterOptions<TWfHandlerMeta, T>): void {
    let fn: ReturnType<typeof defineMoostEventHandler>
    for (const handler of opts.handlers) {
      if (!['WF_STEP', 'WF_FLOW'].includes(handler.type)) {
        continue
      }
      const schemaId = handler.path
      const path =
        typeof schemaId === 'string' ? schemaId : typeof opts.method === 'string' ? opts.method : ''
      const targetPath = `${`${opts.prefix || ''}/${path}`.replaceAll(/\/\/+/g, '/')}${
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
        const _fn = (async () => {
          // the fn() will be instantiating real controller
          // so we have to provide Moost as controller for now
          // so we can use controller context and instantiate moost-level singletones
          // even before real controller is instantiated
          setControllerContext(this.moost!, 'bindHandler' as keyof typeof this.moost, targetPath)
          return fn()
        }) as () => void
        this.toInit.push(() => {
          this.wfApp.flow(targetPath, wfSchema || [], opts.prefix === '/' ? '' : opts.prefix, _fn)
          opts.logHandler(`${__DYE_CYAN__}(${handler.type})${__DYE_GREEN__}${targetPath}`)
        })
      }
    }
  }
}
