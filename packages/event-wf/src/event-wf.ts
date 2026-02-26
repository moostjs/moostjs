import type { TFlowOutput, TWorkflowSpy } from '@prostojs/wf'
import type { TStepHandler, TWooksWfOptions } from '@wooksjs/event-wf'
import { createWfApp, WooksWf } from '@wooksjs/event-wf'
import type { Moost, TMoostAdapter, TMoostAdapterOptions } from 'moost'
import { defineMoostEventHandler, getMoostInfact, setControllerContext, useScopeId } from 'moost'

import { getWfMate } from './meta-types'

/** Metadata attached to a workflow handler by the adapter. */
export interface TWfHandlerMeta {
  path: string
}

const LOGGER_TITLE = 'moost-wf'
const CONTEXT_TYPE = 'WF'

/**
 * Moost adapter for workflow events. Wraps `@wooksjs/event-wf` to register
 * `@Step` and `@Workflow` handlers with full Moost DI and interceptor support.
 *
 * @template T - Workflow context type.
 * @template IR - Intermediate result type.
 *
 * @example
 * ```ts
 * const wf = new MoostWf()
 * app.adapter(wf).controllers(MyWorkflows).init()
 * const result = await wf.start('my-flow', {}, input)
 * ```
 */
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

  /** Returns the underlying `WooksWf` application instance. */
  getWfApp() {
    return this.wfApp
  }

  /** Attaches a spy function that observes workflow step executions. */
  public attachSpy<I>(fn: TWorkflowSpy<T, I, IR>) {
    return this.wfApp.attachSpy<I>(fn)
  }

  /** Detaches a previously attached workflow spy. */
  public detachSpy<I>(fn: TWorkflowSpy<T, I, IR>) {
    this.wfApp.detachSpy<I>(fn)
  }

  /**
   * Starts a new workflow execution.
   *
   * @param schemaId - Identifier of the registered workflow schema.
   * @param initialContext - Initial context data for the workflow.
   * @param input - Optional input passed to the first step.
   */
  public start<I>(schemaId: string, initialContext: T, input?: I): Promise<TFlowOutput<T, I, IR>> {
    return this.wfApp.start(schemaId, initialContext, {
      input,
      cleanup: () => {
        getMoostInfact().unregisterScope(useScopeId())
      },
    })
  }

  /**
   * Resumes a previously paused workflow from a saved state.
   *
   * @param state - Saved workflow state containing schema, context, and step indexes.
   * @param input - Optional input for the resumed step.
   */
  public resume<I>(
    state: { schemaId: string; context: T; indexes: number[] },
    input?: I,
  ): Promise<TFlowOutput<T, I, IR>> {
    return this.wfApp.resume(state, {
      input,
      cleanup: () => {
        getMoostInfact().unregisterScope(useScopeId())
      },
    })
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
        controllerName: opts.controllerName,
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
        // eslint-disable-next-line no-loop-func
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
