// oxlint-disable max-params
import type { TProvideRegistry, TReplaceRegistry } from '@prostojs/infact'
import { createProvideRegistry, Infact } from '@prostojs/infact'
import type { TConsoleBase } from '@prostojs/logger'
import { ProstoLogger } from '@prostojs/logger'
import { getConstructor, isConstructor, Mate } from '@prostojs/mate'
import { createEventContext } from '@wooksjs/event-core'
import { Hookable } from 'hookable'

import { bindControllerMethods } from './binding/bind-controller'
import type { TInitHook } from './binding/bind-types'
import type { TInheritanceAuditMode } from './binding/inheritance-audit'
import { auditInheritance } from './binding/inheritance-audit'
import type { TParamAuditFinding, TParamAuditMode } from './binding/param-audit'
import { auditParams, formatParamAuditError, resolveParamAuditMode } from './binding/param-audit'
import type { TAny, TAnyFn, TClassConstructor, TEmpty, TFunction, TObject } from './common-types'
import { setControllerContext } from './composables'
import type { TInterceptorDef } from './decorators'
import { TInterceptorPriority } from './decorators'
import type { InterceptorHandler } from './interceptor-handler'
import { getDefaultLogger, setDefaultLogger } from './logger'
import type { TInterceptorData, TMoostHandler, TMoostMetadata } from './metadata'
import { getMoostMate } from './metadata'
import { registerDiagnosticsSource } from './metadata/diagnostics'
import { getMoostInfact } from './metadata/infact'
import { sharedPipes } from './pipes/shared-pipes'
import type { TPipeData, TPipeFn } from './pipes/types'
import { TPipePriority } from './pipes/types'
import { mergeSorted } from './shared-utils'
import type { TControllerOverview, THandlerOverview } from './types'
import { getIterceptorHandlerFactory } from './utils'

export type { TConsoleBase } from '@prostojs/logger'
export { ProstoLogger } from '@prostojs/logger'
export { clearGlobalWooks, getGlobalWooks } from 'wooks'

export interface TMoostOptions {
  /**
   * Global path prefix — mounts the whole app under one path segment.
   *
   * This is the first-class "serve everything under `/api`" option: every
   * controller (registered via `registerControllers`, imported through
   * `@ImportController`, or the Moost subclass itself) computes its mount
   * path as `globalPrefix + '/' + <own prefix>`, so
   * `new Moost({ globalPrefix: 'api' })` mounts a `@Controller('users')`
   * class at `/api/users` without touching any registration call.
   *
   * All registration forms stay under `globalPrefix` — even the
   * prefix-replacing ones (`[prefix, Ctrl]` tuple, `mode: 'replace'`) only
   * replace the controller's own `@Controller` prefix, never the global one.
   * Extra/duplicate slashes are normalized by the router.
   */
  globalPrefix?: string
  logger?: TConsoleBase
  /**
   * Bind-time DI diagnostics, evaluated during `init()`.
   *
   * `paramTypes` audits constructor and handler params whose emitted design
   * type is unusable for DI — `Object` (class imported with `import type`, or
   * an interface/union type) or `undefined` (circular import) — and that carry
   * no explicit resolution (`@Inject`, `@Resolve`-based decorators, `@Circular`):
   * - `'error'` — log every finding and reject `init()` when a non-optional
   *   constructor param is affected (it would fail at instantiation anyway);
   * - `'warn'` — log findings, never throw;
   * - `'off'` — skip the audit entirely.
   *
   * Defaults to `'error'` when `NODE_ENV !== 'production'`, `'warn'` otherwise.
   * Optional/nullable constructor params and handler method params are always
   * warn-only (`undefined` injection is legal there).
   */
  diagnostics?: {
    paramTypes?: TParamAuditMode
    /**
     * `inheritance` audits every registered controller for the two subclassing
     * traps (warn-only, never rejects `init()`):
     * - a class that registered 0 handlers while an ancestor defines some,
     *   without a deliberate `@Inherit(false)` opt-out — parent routes
     *   silently 404 (fires both when no `@Inherit` decision exists and when
     *   `@Inherit()` is present but an undecorated intermediate class breaks
     *   the chain — the warning names the broken link);
     * - a DI-instantiated class with no effective constructor param metadata
     *   while a decorated ancestor declares constructor params — dependencies
     *   silently resolve to `undefined` (or the class is not seen as
     *   injectable at all when it carries no metadata).
     *
     * `'warn'` (default) logs a warning naming both classes and the fix
     * (`@Inherit()` or re-declaring); `'off'` skips the audit.
     */
    inheritance?: TInheritanceAuditMode
  }
}

/**
 * Object registration form for {@link Moost.registerControllers}: mounts a
 * group of controllers under a shared path prefix with explicit composition
 * semantics (see `mode`).
 */
export interface TControllersGroup {
  /**
   * Path segment applied to every controller of the group
   * (always mounted under `globalPrefix` when one is set).
   */
  prefix: string
  /** Controllers (classes or instances) to register. */
  controllers: (TObject | TFunction)[]
  /**
   * How `prefix` combines with each controller's own `@Controller(...)` prefix:
   * - `'prepend'` (default) — `globalPrefix + '/' + prefix + '/' + own prefix`;
   * - `'replace'` — `prefix` replaces the controller's own prefix
   *   (same semantics as the `[prefix, controller]` tuple form).
   */
  mode?: 'prepend' | 'replace'
}

/**
 * Normalized internal shape of a pending controller registration —
 * `registerControllers` reduces all of its accepted forms to this.
 */
export interface TControllerRegistration {
  controller: TObject | TFunction
  /**
   * Replaces the controller's own `@Controller` prefix
   * (tuple form / object form with `mode: 'replace'`).
   */
  replaceOwnPrefix?: string
  /**
   * Inserted between `globalPrefix` and the controller's own prefix
   * (object form with `mode: 'prepend'`).
   */
  prependPrefix?: string
}

/**
 * Detects the object registration form of `registerControllers`: a plain
 * object (no class prototype) carrying a `controllers` array. Controller
 * instances are class instances and never match, so all pre-existing
 * registration forms bind unchanged.
 */
function isControllersGroup(
  entry: TObject | TFunction | [string, TObject | TFunction] | TControllersGroup,
): entry is TControllersGroup {
  if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
    return false
  }
  const proto: unknown = Object.getPrototypeOf(entry)
  return (
    (proto === Object.prototype || proto === null) &&
    Array.isArray((entry as TControllersGroup).controllers)
  )
}

/**
 * ## Moost
 * Main moostjs class that serves as a shell for Moost Adapters
 *
 * ### Usage with HTTP Adapter
 * ```ts
 * │  // HTTP server example
 * │  import { MoostHttp, Get } from '@moostjs/event-http'
 * │  import { Moost, Param } from 'moost'
 * │
 * │  class MyServer extends Moost {
 * │      @Get('test/:name')
 * │      test(@Param('name') name: string) {
 * │          return { message: `Hello ${name}!` }
 * │      }
 * │  }
 * │
 * │  const app = new MyServer()
 * │  const http = new MoostHttp()
 * │  app.adapter(http).listen(3000, () => {
 * │      app.getLogger('MyApp').log('Up on port 3000')
 * │  })
 * │  app.init()
 * ```
 * ### Usage with CLI Adapter
 * ```ts
 * │  // CLI example
 * │  import { MoostCli, Cli, CliOption, cliHelpInterceptor } from '@moostjs/event-cli'
 * │  import { Moost, Param } from 'moost'
 * │
 * │  class MyApp extends Moost {
 * │      @Cli('command/:arg')
 * │      command(
 * │         @Param('arg')
 * │         arg: string,
 * │         @CliOption('test', 't')
 * │         test: boolean,
 * │      ) {
 * │          return `command run with flag arg=${ arg }, test=${ test }`
 * │      }
 * │  }
 * │
 * │  const app = new MyApp()
 * │  app.applyGlobalInterceptors(cliHelpInterceptor())
 * │
 * │  const cli = new MoostCli()
 * │  app.adapter(cli)
 * │  app.init()
 * ```
 */
export class Moost extends Hookable {
  protected logger: TConsoleBase

  protected pipes: TPipeData[] = Array.from(sharedPipes)

  protected interceptors: TInterceptorData[] = []

  protected adapters: TMoostAdapter<TAny>[] = []

  protected controllersOverview: TControllerOverview[] = []

  protected handlerOverviewIndex?: Map<TFunction, Map<string, THandlerOverview[]>>

  protected initHooks: TInitHook[] = []

  protected provide: TProvideRegistry = createProvideRegistry(
    [Infact, getMoostInfact],
    [Mate, getMoostMate],
  )

  protected replace: TReplaceRegistry = {}

  protected unregisteredControllers: TControllerRegistration[] = []

  /** D1 param-audit findings collected while binding controllers, flushed by `init()`. */
  protected paramAuditFindings: TParamAuditFinding[] = []

  /** Effective `diagnostics.paramTypes` mode, resolved once (see {@link TMoostOptions}). */
  protected readonly paramAuditMode: TParamAuditMode

  /** Effective `diagnostics.inheritance` mode (see {@link TMoostOptions}). */
  protected readonly inheritanceAuditMode: TInheritanceAuditMode

  /** D5: set once `init()` completes — late provide/replace registrations then warn. */
  protected initialized = false

  constructor(protected options?: TMoostOptions) {
    super()
    this.paramAuditMode = resolveParamAuditMode(options?.diagnostics?.paramTypes)
    this.inheritanceAuditMode = options?.diagnostics?.inheritance || 'warn'
    this.logger = options?.logger || getDefaultLogger(`${__DYE_DIM__ + __DYE_MAGENTA__}moost`)
    setDefaultLogger(this.logger)
    const mate = getMoostMate()
    Object.assign(mate, { logger: this.getLogger('mate') })
  }

  _fireEventStart(source: TMoostAdapter<unknown>) {
    this.callHook('event-start', source)
  }

  _fireEventEnd(source: TMoostAdapter<unknown>) {
    this.callHook('event-end', source)
  }

  /**
   * ### getLogger
   * Provides application logger
   * ```js
   * // get logger with topic = "App"
   * const logger = app.getLogger('App')
   * logger.log('...')
   * ```
   * @param topic
   * @returns
   */
  public getLogger(topic?: string) {
    if (topic && this.logger instanceof ProstoLogger) {
      return this.logger.createTopic(topic)
    }
    return this.logger
  }

  public adapter<T extends TMoostAdapter<TAny>>(a: T) {
    this.adapters.push(a)
    return a
  }

  public getControllersOverview() {
    return this.controllersOverview
  }

  /**
   * @internal Memoized index of the controllers overview (controller class →
   * method name → handler records), built once and reused for fast handler
   * lookups (see `getHandlerPaths`). Rebuilt whenever controllers are (re)bound.
   */
  public getHandlerOverviewIndex(): Map<TFunction, Map<string, THandlerOverview[]>> {
    if (!this.handlerOverviewIndex) {
      const index = new Map<TFunction, Map<string, THandlerOverview[]>>()
      for (const c of this.controllersOverview) {
        let byMethod = index.get(c.type)
        if (!byMethod) {
          byMethod = new Map<string, THandlerOverview[]>()
          index.set(c.type, byMethod)
        }
        for (const h of c.handlers) {
          const list = byMethod.get(h.method)
          if (list) {
            list.push(h)
          } else {
            byMethod.set(h.method, [h])
          }
        }
      }
      this.handlerOverviewIndex = index
    }
    return this.handlerOverviewIndex
  }

  /**
   * ### init
   * Ititializes adapter. Must be called after adapters are attached.
   */
  public async init() {
    this.setProvideRegistry(
      createProvideRegistry(
        [Moost, () => this],
        [ProstoLogger, () => this.logger],
        ['MOOST_LOGGER', () => this.logger],
      ),
    )
    for (const a of this.adapters) {
      const constructor = getConstructor(a)
      if (constructor) {
        this.setProvideRegistry(createProvideRegistry([constructor as TClassConstructor, () => a]))
      }
      if (typeof a.getProvideRegistry === 'function') {
        this.setProvideRegistry(a.getProvideRegistry())
      }
    }
    this.unregisteredControllers.unshift({ controller: this })
    let auditError: string | undefined
    try {
      await this.bindControllers()
    } finally {
      // D4: expose this app's controllers overview to the DI diagnostics scans
      registerDiagnosticsSource(this)
      // D1 findings are logged even when binding threw; a bind error then
      // propagates from the try block, taking precedence over the audit error
      auditError = this.flushParamAudit()
    }
    if (auditError) {
      throw new Error(auditError)
    }
    await this.runInitHooks()
    for (const a of this.adapters) {
      await (a.onInit && a.onInit(this))
    }
    // Flagged only after the adapters' onInit loop: registry updates made by
    // init() itself (top of this method) or by adapters during boot are part
    // of the normal init flow and must not trigger the D5 late-registration
    // warning below (setProvideRegistry/setReplaceRegistry).
    this.initialized = true
  }

  /**
   * Runs every `@MoostInit`-decorated controller method exactly once, after all
   * controllers are bound (complete `getControllersOverview()`) and before the
   * `adapter.onInit` loop. Hooks run in ascending `priority`, then registration
   * order. Each runs on its controller's SINGLETON instance inside a synthetic
   * init context (no interceptors; params resolve via the RESOLVE pipe only).
   * A throwing hook rejects `init()` (fail-fast).
   */
  protected async runInitHooks() {
    if (this.initHooks.length === 0) {
      return
    }
    const hooks = this.initHooks.toSorted((a, b) => a.priority - b.priority)
    for (const hook of hooks) {
      await createEventContext({ logger: this.logger }, async () => {
        const instance = await hook.getInstance()
        setControllerContext(instance, hook.method as keyof typeof instance, '', {
          prefix: hook.computedPrefix,
        })
        const args = hook.resolveArgs ? await hook.resolveArgs() : []
        await (instance as Record<string, TAnyFn>)[hook.method](...args)
      })
    }
  }

  /**
   * D1 audit of a DI-instantiated controller class' constructor params.
   * Findings are collected for `init()` to flush. Returns `true` when the
   * bind-time SINGLETON instantiation must be skipped: in `'error'` mode a
   * fatal-capable finding guarantees `init()` rejects with the aggregated
   * audit error (naming class and param), which the generic infact
   * instantiation error would otherwise preempt.
   */
  protected collectConstructorAudit(className: string, classMeta?: TMoostMetadata): boolean {
    if (this.paramAuditMode === 'off' || !classMeta?.injectable) {
      return false
    }
    const findings = auditParams(classMeta.params, { className })
    this.paramAuditFindings.push(...findings)
    return this.paramAuditMode === 'error' && findings.some((f) => f.severity === 'fatal-capable')
  }

  /**
   * Flushes D1 findings collected during binding: every finding is logged as a
   * warning; in `'error'` mode, fatal-capable findings are folded into one
   * aggregate error message listing all of them, returned for `init()` to
   * throw (`init()` owns the precedence between this and a bind error).
   */
  protected flushParamAudit(): string | undefined {
    const findings = this.paramAuditFindings
    this.paramAuditFindings = []
    for (const f of findings) {
      this.logger.warn(f.message)
    }
    const fatal = findings.filter((f) => f.severity === 'fatal-capable')
    if (fatal.length > 0 && this.paramAuditMode === 'error') {
      return formatParamAuditError(fatal)
    }
    return undefined
  }

  protected async bindControllers() {
    const meta = getMoostMate()
    const thisMeta = meta.read(this)
    const provide = { ...thisMeta?.provide, ...this.provide }
    const replace = { ...thisMeta?.replace, ...this.replace }
    const globalPrefix = this.options?.globalPrefix || ''
    for (const { controller, prependPrefix, replaceOwnPrefix } of this.unregisteredControllers) {
      await this.bindController(
        controller,
        provide,
        replace,
        prependPrefix ? `${globalPrefix}/${prependPrefix}` : globalPrefix,
        replaceOwnPrefix,
      )
    }
    this.unregisteredControllers = []
  }

  protected async bindController(
    controller: TFunction | TObject,
    provide: TProvideRegistry,
    replace: TReplaceRegistry,
    globalPrefix: string,
    replaceOwnPrefix?: string,
  ) {
    const mate = getMoostMate()
    const classMeta = mate.read(controller)
    const infact = getMoostInfact()
    const isControllerConsructor = isConstructor(controller)

    const ownPrefix =
      typeof replaceOwnPrefix === 'string' ? replaceOwnPrefix : classMeta?.controller?.prefix || ''
    const computedPrefix = `${globalPrefix}/${ownPrefix}`

    const pipes = mergeSorted(this.pipes, classMeta?.pipes)
    let instance: TObject | undefined
    const infactOpts = { provide, replace, customData: { pipes } }
    const skipInstantiation =
      isControllerConsructor &&
      this.collectConstructorAudit((controller as TFunction).name, classMeta)
    if (
      !skipInstantiation &&
      isControllerConsructor &&
      (classMeta?.injectable === 'SINGLETON' || classMeta?.injectable === true)
    ) {
      await createEventContext({ logger: this.logger }, async () => {
        setControllerContext(this, 'bindController' as keyof this, '', { prefix: computedPrefix })
        instance = (await infact.get(
          controller as TClassConstructor<TAny>,
          infactOpts,
        )) as Promise<TObject>
      })
    } else if (!isControllerConsructor) {
      instance = controller
      infact.setInstanceRegistries(instance, provide, replace, { pipes })
    }

    // getInstance - instance factory for resolving SINGLETON and FOR_EVENT instance
    const getInstance = instance
      ? () => instance!
      : async (): Promise<TObject> =>
          (await infact.get(controller as TClassConstructor<TAny>, {
            ...infactOpts,
          })) as Promise<TObject>

    const classConstructor = isConstructor(controller)
      ? controller
      : (getConstructor(controller) as TClassConstructor)
    const controllerOverview = await bindControllerMethods({
      getInstance,
      classConstructor,
      adapters: this.adapters,
      globalPrefix,
      replaceOwnPrefix,
      interceptors: Array.from(this.interceptors),
      pipes,
      provide: classMeta?.provide,
      replace: classMeta?.replace,
      logger: this.logger,
      moostInstance: this,
      registerInitHook: (hook) => this.initHooks.push(hook),
      reportParamAudit:
        this.paramAuditMode === 'off'
          ? undefined
          : (findings) => this.paramAuditFindings.push(...findings),
    })
    this.controllersOverview.push(controllerOverview)
    // §3 inheritance audit (warn-only) — route-drop and lost-ctor-params traps
    if (this.inheritanceAuditMode !== 'off') {
      this.paramAuditFindings.push(
        ...auditInheritance({
          classConstructor,
          classMeta,
          ownHandlersCount: controllerOverview.handlers.length,
          diInstantiated: isControllerConsructor,
        }),
      )
    }
    this.handlerOverviewIndex = undefined // overview changed — drop the memoized index
    if (classMeta?.importController) {
      const prefix =
        typeof replaceOwnPrefix === 'string' ? replaceOwnPrefix : classMeta.controller?.prefix
      const mergedProvide = { ...provide, ...classMeta.provide }
      const mergedReplace = { ...this.replace, ...classMeta.replace }
      for (const ic of classMeta.importController) {
        if (ic.typeResolver) {
          const isConstr = isConstructor(ic.typeResolver)
          const isFunc = typeof ic.typeResolver === 'function'
          await this.bindController(
            isConstr
              ? ic.typeResolver
              : isFunc
                ? await (ic.typeResolver as TFunction)()
                : ic.typeResolver,
            ic.provide ? { ...mergedProvide, ...ic.provide } : mergedProvide,
            mergedReplace,
            `${globalPrefix}/${prefix || ''}`,
            ic.prefix,
          )
        }
      }
    }
  }

  applyGlobalPipes(...items: (TPipeFn | TPipeData)[]) {
    for (const item of items) {
      if (typeof item === 'function') {
        this.pipes.push({
          handler: item,
          priority: typeof item.priority === 'number' ? item.priority : TPipePriority.TRANSFORM,
        })
      } else {
        this.pipes.push({
          handler: item.handler,
          priority: item.priority,
        })
      }
    }
    this.globalInterceptorHandler = undefined
    return this
  }

  protected globalInterceptorHandler?: () => InterceptorHandler | undefined

  /**
   * Provides InterceptorHandler with global interceptors and pipes.
   * Used to process interceptors when event handler was not found.
   *
   * @returns IterceptorHandler
   */
  getGlobalInterceptorHandler() {
    if (!this.globalInterceptorHandler) {
      const mate = getMoostMate()
      const thisMeta = mate.read(this)
      const pipes = mergeSorted(this.pipes, thisMeta?.pipes)
      const interceptors = mergeSorted(this.interceptors, thisMeta?.interceptors)
      this.globalInterceptorHandler = getIterceptorHandlerFactory(
        interceptors,
        () => this as unknown as TObject,
        pipes,
      )
    }
    return this.globalInterceptorHandler()
  }

  applyGlobalInterceptors(...items: (TClassConstructor | TInterceptorDef | TInterceptorData)[]) {
    const mate = getMoostMate()
    for (const item of items) {
      if (typeof item === 'function') {
        // Class constructor with @Interceptor metadata
        const meta = mate.read(item)
        this.interceptors.push({
          handler: item,
          priority: meta?.interceptor?.priority ?? TInterceptorPriority.INTERCEPTOR,
          name: item.name || '<anonymous>',
        })
      } else if ('handler' in item) {
        // TInterceptorData (already wrapped)
        this.interceptors.push(item as TInterceptorData)
      } else {
        // TInterceptorDef (object with before/after/error)
        this.interceptors.push({
          handler: item,
          priority: item.priority ?? TInterceptorPriority.INTERCEPTOR,
          name: item._name || '<anonymous>',
        })
      }
    }
    this.globalInterceptorHandler = undefined
    return this
  }

  /**
   * Register new entries to provide as dependency injections
   *
   * Ordering rule: call this **before `init()`**. `init()` snapshots the
   * provide registry once when binding controllers, so entries added later are
   * never seen by already-bound controllers (sibling registration order does
   * not matter — only the before/after-`init()` boundary does). To scope
   * providers to part of the app, use class-level `@Provide` on a parent
   * controller — it flows parent → child through `@ImportController`, never
   * to siblings.
   * @param provide - Provide Registry (use createProvideRegistry from '\@prostojs/infact')
   * @returns
   */
  setProvideRegistry(provide: TProvideRegistry) {
    if (this.initialized) {
      this.logger.warn(
        '[moost] setProvideRegistry() called after init() — already-bound controllers will not ' +
          'see these providers. Register providers before init(), or provide them via @Provide ' +
          'on a parent controller.',
      )
    }
    this.provide = { ...this.provide, ...provide }
    return this
  }

  /**
   * Register replace classes to provide as dependency injections
   *
   * Ordering rule: call this **before `init()`**. `init()` snapshots the
   * replace registry once when binding controllers, so replacements added
   * later are never seen by already-bound controllers.
   * @param replace - Replace Registry (use createReplaceRegistry from '\@prostojs/infact')
   * @returns
   */
  setReplaceRegistry(replace: TReplaceRegistry) {
    if (this.initialized) {
      this.logger.warn(
        '[moost] setReplaceRegistry() called after init() — already-bound controllers will not ' +
          'see these replacements. Register replacements before init().',
      )
    }
    this.replace = { ...this.replace, ...replace }
    return this
  }

  /**
   * Register controllers with the app (similar to the `@ImportController` decorator).
   *
   * Accepted forms (mixable in one call):
   *
   * 1. **Class or instance** — `registerControllers(UsersController)`.
   *    Mounted at `globalPrefix + '/' + own @Controller prefix`.
   *
   * 2. **Tuple `[prefix, controller]`** — `registerControllers(['api/users', UsersController])`.
   *    **IMPORTANT: the string REPLACES the controller's own `@Controller(...)` prefix — it does
   *    NOT prepend to it.** `['api', UsersController]` mounts a `@Controller('users')` class at
   *    `/api`, not `/api/users`, so every tuple registration must repeat the full path.
   *    To compose prefixes instead, use the object form below.
   *
   * 3. **Object group `{ prefix, controllers, mode? }`** —
   *    `registerControllers({ prefix: 'api', controllers: [UsersController] })`.
   *    Registers every entry of `controllers` under `prefix`:
   *    - `mode: 'prepend'` (default) composes the prefixes:
   *      `globalPrefix + '/' + prefix + '/' + own @Controller prefix`
   *      (a `@Controller('users')` class mounts at `/api/users`);
   *    - `mode: 'replace'` replaces each controller's own prefix with `prefix`
   *      (same semantics as the tuple form).
   *
   * The object form is detected only for plain objects with a `controllers` array, so
   * controller classes, instances and tuples keep working unchanged. To mount the whole
   * app under one segment, prefer the `globalPrefix` option (see {@link TMoostOptions}).
   *
   * @param controllers - controllers to register: classes, instances,
   *   `[prefix, controller]` tuples or `{ prefix, controllers, mode? }` groups
   * @returns
   */
  public registerControllers(
    ...controllers: (TObject | TFunction | [string, TObject | TFunction] | TControllersGroup)[]
  ) {
    for (const entry of controllers) {
      if (Array.isArray(entry) && typeof entry[0] === 'string') {
        this.unregisteredControllers.push({
          controller: entry[1],
          replaceOwnPrefix: entry[0],
        })
      } else if (isControllersGroup(entry)) {
        for (const controller of entry.controllers) {
          this.unregisteredControllers.push(
            entry.mode === 'replace'
              ? { controller, replaceOwnPrefix: entry.prefix }
              : { controller, prependPrefix: entry.prefix },
          )
        }
      } else {
        this.unregisteredControllers.push({ controller: entry })
      }
    }
    return this
  }

  public logMappedHandler(
    eventName: string,
    classConstructor: Function,
    method: string,
    stroke?: boolean,
    prefix?: string,
  ) {
    const c = stroke ? '\u001B[9m' : '' // crossed
    const coff = stroke ? '\u001B[29m' : '' // crossed off
    this.logger.info(
      `${prefix || ''}${c}${eventName} ${__DYE_RESET__ + __DYE_DIM__ + __DYE_GREEN__ + c}→ ${
        classConstructor.name
      }.${__DYE_CYAN__ + c}${method}${__DYE_GREEN__}()${coff}`,
    )
  }
}

export interface TMoostAdapterOptions<H, T> {
  prefix: string
  fakeInstance: T
  getInstance: () => Promise<T> | T
  method: keyof T
  handlers: TMoostHandler<H>[]
  getIterceptorHandler: () => InterceptorHandler | undefined
  resolveArgs?: () => Promise<unknown[]> | unknown[]
  controllerName?: string
  logHandler: (eventName: string) => void
  register: (handler: TMoostHandler<TEmpty>, path: string, args: string[]) => void
}

export interface TMoostAdapter<H> {
  name: string
  bindHandler: <T extends TObject = TObject>(
    options: TMoostAdapterOptions<H, T>,
  ) => void | Promise<void>
  onInit?: (moost: Moost) => void | Promise<void>
  getProvideRegistry?: () => TProvideRegistry
}
