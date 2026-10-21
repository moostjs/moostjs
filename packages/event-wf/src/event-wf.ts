import type { TFlowOutput, TWorkflowSpy } from '@prostojs/wf'
import type {
  TStepHandler,
  TWfRunOptions,
  TWooksWfOptions,
  WfMintTokenOptions,
  WfMintTokenResult,
  WfOutletTriggerConfig,
  WfOutletTriggerDeps,
} from '@wooksjs/event-wf'
import { createWfApp, handleWfOutletRequest, mintWfToken, WooksWf } from '@wooksjs/event-wf'
import type { EventContext, Moost, TMoostAdapter, TMoostAdapterOptions } from 'moost'
import { defineMoostEventHandler, MOOST_ADAPTER_BRAND, setControllerContext } from 'moost'

import { getWfMate } from './meta-types'
import { releaseRunScopes } from './run-scope'

/** Metadata attached to a workflow handler by the adapter. */
export interface TWfHandlerMeta {
  path: string
}

const LOGGER_TITLE = 'moost-wf'

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
 * const result = await wf.start('my-flow', {}, { input })
 * ```
 */
export class MoostWf<T = any, IR = any> implements TMoostAdapter<TWfHandlerMeta> {
  /** Names this adapter for DI independently of class identity (see `MOOST_ADAPTER_BRAND`). */
  static readonly [MOOST_ADAPTER_BRAND] = '@moostjs/event-wf/MoostWf'

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
    releaseRunScopes(this.wfApp)
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
   * Handles an outlet trigger request within an HTTP handler.
   *
   * Reads `wfid` (workflow ID) and `wfs` (state token) from the HTTP request,
   * starts or resumes the workflow, and dispatches pauses to registered outlets.
   * `allow`/`block` are judged on the registered flow id the request resolves to
   * (see {@link MoostWf.resolveSchemaId}).
   *
   * Must be called from within an HTTP event context (e.g. a `@Post` handler)
   * so that wooks HTTP composables are available.
   *
   * @param config - Outlet trigger configuration (allowed workflows, state strategy, outlets, etc.)
   * @returns The outlet result (form payload + token) or the finished response. Refusals
   *   (missing/invalid/expired token, forbidden or unknown flow) are thrown as `HttpError`s
   *   with a `code` (`WF_MISSING`, `WF_INVALID_TOKEN`, `WF_EXPIRED`, `WF_FORBIDDEN`, …).
   */
  public handleOutlet(config: WfOutletTriggerConfig): Promise<unknown> {
    // MoostWf has the deps' start / resume / resolveSchemaId
    return handleWfOutletRequest(config, this as unknown as WfOutletTriggerDeps)
  }

  /**
   * Resolves a workflow id, spelled as a caller would pass it to `start()` (`'auth/login'`,
   * `'/auth/login'`, `'user/42'`), to the id of the registered flow `start()` would run
   * (`'/auth/login'`, `'/user/:id'`) — also what a paused run stores as `state.schemaId`.
   * Returns `undefined` when no flow matches.
   *
   * @param id - Workflow id as a caller spells it.
   * @param opts - `eventContext`: the parent event `start()` would get (e.g. the HTTP request).
   */
  public resolveSchemaId(
    id: string,
    opts?: { eventContext?: EventContext },
  ): Promise<string | undefined> {
    return this.wfApp.resolveSchemaId(id, opts)
  }

  /**
   * Starts a workflow without a request and persists its first pause the way the outlet
   * trigger does, returning a token the trigger resumes (`<strategy>.<handle>`) — for
   * server-initiated flows: invites, approval links, scheduled reminders. No outlet is called:
   * deliver the token yourself. `allow`/`block` are not checked here; they apply on resume.
   * The run's DI scope is released when it pauses or ends.
   *
   * @param options - `wfid`, `context`, `input`, the trigger's `state` config, `ttl` (ms),
   *   `meta`, and an optional parent `eventContext`.
   *
   * @example
   * ```ts
   * const { token } = await wf.mint({ wfid: 'invite', context: { email }, state, ttl: 7 * 86_400_000 })
   * if (token) await sendInvite(email, `https://app.example/invite?wfs=${token}`)
   * ```
   */
  public mint(options: WfMintTokenOptions): Promise<WfMintTokenResult> {
    return mintWfToken(this as unknown as WfOutletTriggerDeps, options)
  }

  /**
   * Starts a new workflow execution.
   *
   * @param schemaId - Identifier of the registered workflow schema.
   * @param initialContext - Initial context data for the workflow.
   * @param opts - Optional run options: `input` for the first step, `eventContext`
   *   to link this run to a parent event scope (e.g. an HTTP request), and
   *   `strategy.name` to pick the initial state strategy. Passing a bare
   *   `input` value (legacy positional form) is no longer supported — wrap it
   *   in `{ input }`.
   */
  public start<I>(
    schemaId: string,
    initialContext: T,
    opts?: TWfRunOptions<I, T, IR>,
  ): Promise<TFlowOutput<T, I, IR>> {
    // the run's DI scope is released by the wfApp itself (see releaseRunScopes)
    return this.wfApp.start(schemaId, initialContext, opts)
  }

  /**
   * Resumes a previously paused workflow from a saved state.
   *
   * @param state - Saved workflow state containing schema, context, and step indexes.
   * @param opts - Optional run options: `input` for the resumed step, `eventContext`
   *   for parent-chain composable access, and `strategy.name` for the strategy
   *   that loaded this state. Legacy positional `input` is no longer supported.
   */
  public resume<I>(
    state: { schemaId: string; context: T; indexes: number[] },
    opts?: TWfRunOptions<I, T, IR>,
  ): Promise<TFlowOutput<T, I, IR>> {
    return this.wfApp.resume(state, opts)
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
        loggerTitle: LOGGER_TITLE,
        getIterceptorHandler: opts.getIterceptorHandler,
        getControllerInstance: opts.getInstance,
        controllerMethod: opts.method,
        controllerName: opts.controllerName,
        resolveArgs: opts.resolveArgs,
        manualUnscope: true,
        targetPath,
        controllerPrefix: opts.prefix,
        handlerType: handler.type,
      })

      if (handler.type === 'WF_STEP') {
        const stepTTL = getWfMate().read(opts.fakeInstance, opts.method as string)?.wfStepTTL
        let stepHandler = fn
        if (stepTTL !== undefined) {
          const wrapped = stepHandler
          stepHandler = async () => {
            try {
              const result = await wrapped()
              if (result && typeof result === 'object' && 'inputRequired' in result) {
                return { ...(result as Record<string, unknown>), expires: Date.now() + stepTTL }
              }
              return result
            } catch (error) {
              // A step can also re-pause by throwing requireInput() (a
              // StepRetriableError). Stamp the step TTL on that path too, but
              // only when the error doesn't already carry one (so an explicitly
              // stamped error TTL is respected). Duck-type rather than
              // `instanceof StepRetriableError`: the error is constructed inside
              // @wooksjs/event-wf and its class identity isn't guaranteed to
              // match across @prostojs/wf copies in a consumer's install.
              if (
                error &&
                typeof error === 'object' &&
                'inputRequired' in error &&
                (error as { expires?: number }).expires === undefined
              ) {
                ;(error as { expires?: number }).expires = Date.now() + stepTTL
              }
              throw error
            }
          }
        }
        this.wfApp.step(targetPath, { handler: stepHandler as TStepHandler<any, any, any> })
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
          setControllerContext(this.moost!, 'bindHandler' as keyof typeof this.moost, targetPath, {
            prefix: opts.prefix,
          })
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
