import type { TProvideRegistry, TReplaceRegistry } from '@prostojs/infact'
import { createProvideRegistry, Infact } from '@prostojs/infact'
import type { TConsoleBase } from '@prostojs/logger'
import { ProstoLogger } from '@prostojs/logger'
import { getConstructor, isConstructor, Mate } from '@prostojs/mate'
import { createAsyncEventContext } from '@wooksjs/event-core'
import type { TAny, TClassConstructor, TEmpty, TFunction, TObject } from 'common'
import { getDefaultLogger } from 'common'
import { Hookable } from 'hookable'

import { bindControllerMethods } from './binding/bind-controller'
import { setControllerContext } from './composables'
import type { TInterceptorFn } from './decorators'
import { TInterceptorPriority } from './decorators'
import type { InterceptorHandler } from './interceptor-handler'
import type { TInterceptorData, TMoostHandler } from './metadata'
import { getMoostMate } from './metadata'
import { getMoostInfact } from './metadata/infact'
import { sharedPipes } from './pipes/shared-pipes'
import type { TPipeData, TPipeFn } from './pipes/types'
import { TPipePriority } from './pipes/types'
import type { TControllerOverview } from './types'
import { getIterceptorHandlerFactory } from './utils'

export interface TMoostOptions {
  /**
   * Prefix that is used for each event path
   */
  globalPrefix?: string
  logger?: TConsoleBase
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

  protected adapters: Array<TMoostAdapter<TAny>> = []

  protected controllersOverview: TControllerOverview[] = []

  protected provide: TProvideRegistry = createProvideRegistry(
    [Infact, getMoostInfact],
    [Mate, getMoostMate]
  )

  protected replace: TReplaceRegistry = {}

  protected unregisteredControllers: Array<TObject | TFunction | [string, TObject | TFunction]> = []

  constructor(protected options?: TMoostOptions) {
    super()
    this.logger = options?.logger || getDefaultLogger('moost')
    getMoostInfact().setLogger(this.getLogger('infact'))
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
  public getLogger(topic: string) {
    if (this.logger instanceof ProstoLogger) {
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
   * ### init
   * Ititializes adapter. Must be called after adapters are attached.
   */
  public async init() {
    this.setProvideRegistry(
      createProvideRegistry(
        [Moost, () => this],
        [ProstoLogger, () => this.logger],
        ['MOOST_LOGGER', () => this.logger]
      )
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
    this.unregisteredControllers.unshift(this)
    await this.bindControllers()
    for (const a of this.adapters) {
      await (a.onInit && a.onInit(this))
    }
  }

  protected async bindControllers() {
    const infact = getMoostInfact()
    infact.setLogger(this.logger)
    const meta = getMoostMate()
    const thisMeta = meta.read(this)
    const provide = { ...thisMeta?.provide, ...this.provide }
    const replace = { ...thisMeta?.replace, ...this.replace }
    for (const _controller of this.unregisteredControllers) {
      let newPrefix: string | undefined
      let controller = _controller
      if (Array.isArray(_controller) && typeof _controller[0] === 'string') {
        newPrefix = _controller[0]
        controller = _controller[1] as TObject
      }
      await this.bindController(
        controller,
        provide,
        replace,
        this.options?.globalPrefix || '',
        newPrefix
      )
    }
    this.unregisteredControllers = []
  }

  protected async bindController(
    controller: TFunction | TObject,
    provide: TProvideRegistry,
    replace: TReplaceRegistry,
    globalPrefix: string,
    replaceOwnPrefix?: string
  ) {
    const mate = getMoostMate()
    const classMeta = mate.read(controller)
    const infact = getMoostInfact()
    const isControllerConsructor = isConstructor(controller)

    const pipes = [...this.pipes, ...(classMeta?.pipes || [])].sort(
      (a, b) => a.priority - b.priority
    )
    let instance: TObject | undefined
    const infactOpts = { provide, replace, customData: { pipes } }
    if (
      isControllerConsructor &&
      (classMeta?.injectable === 'SINGLETON' || classMeta?.injectable === true)
    ) {
      await createAsyncEventContext({
        event: { type: 'init' },
        options: {},
      })(async () => {
        setControllerContext(this, 'bindController' as keyof this)
        instance = (await infact.get(
          controller as TClassConstructor<TAny>,
          infactOpts
        )) as Promise<TObject>
      })
    } else if (!isControllerConsructor) {
      instance = controller
      infact.setInstanceRegistries(instance, provide, replace, { pipes })
    }

    // getInstance - instance factory for resolving SINGLETON and FOR_EVENT instance
    const getInstance = instance
      ? () => Promise.resolve(instance!)
      : async (): Promise<TObject> => {
          // if (!instance) {
          infact.silent(true)
          const instance = (await infact.get(controller as TClassConstructor<TAny>, {
            ...infactOpts,
          })) as Promise<TObject>
          infact.silent(false)
          // }
          return instance
        }

    const classConstructor = isConstructor(controller)
      ? controller
      : (getConstructor(controller) as TClassConstructor)
    this.controllersOverview.push(
      await bindControllerMethods({
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
      })
    )
    if (classMeta && classMeta.importController) {
      const prefix =
        typeof replaceOwnPrefix === 'string' ? replaceOwnPrefix : classMeta.controller?.prefix
      const mergedProvide = { ...provide, ...classMeta.provide }
      const mergedReplace = { ...this.replace, ...classMeta.replace }
      for (const ic of classMeta.importController) {
        if (ic.typeResolver) {
          const isConstr = isConstructor(ic.typeResolver)
          const isFunc = typeof ic.typeResolver === 'function'
          await this.bindController(
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            isConstr
              ? ic.typeResolver
              : isFunc
                ? await (ic.typeResolver as TFunction)()
                : ic.typeResolver,
            ic.provide ? { ...mergedProvide, ...ic.provide } : mergedProvide,
            mergedReplace,
            `${globalPrefix}/${prefix || ''}`,
            ic.prefix
          )
        }
      }
    }
  }

  applyGlobalPipes(...items: Array<TPipeFn | TPipeData>) {
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

  protected globalInterceptorHandler?: () => Promise<InterceptorHandler>

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
      const pipes = [...(this.pipes || []), ...(thisMeta?.pipes || [])].sort(
        (a, b) => a.priority - b.priority
      )
      const interceptors = [...this.interceptors, ...(thisMeta?.interceptors || [])].sort(
        (a, b) => a.priority - b.priority
      )
      this.globalInterceptorHandler = getIterceptorHandlerFactory(
        interceptors,
        () => Promise.resolve(this as unknown as TObject),
        pipes,
        this.logger
      )
    }
    return this.globalInterceptorHandler()
  }

  applyGlobalInterceptors(...items: Array<TInterceptorData['handler'] | TInterceptorData>) {
    for (const item of items) {
      if (typeof item === 'function') {
        this.interceptors.push({
          handler: item,
          priority:
            typeof (item as TInterceptorFn).priority === 'number'
              ? (item as TInterceptorFn).priority!
              : TInterceptorPriority.INTERCEPTOR,
        })
      } else {
        this.interceptors.push({
          handler: item.handler,
          priority: item.priority,
        })
      }
    }
    this.globalInterceptorHandler = undefined
    return this
  }

  /**
   * Register new entries to provide as dependency injections
   * @param provide - Provide Registry (use createProvideRegistry from '\@prostojs/infact')
   * @returns
   */
  setProvideRegistry(provide: TProvideRegistry) {
    this.provide = { ...this.provide, ...provide }
    return this
  }

  /**
   * Register replace classes to provide as dependency injections
   * @param replace - Replace Registry (use createReplaceRegistry from '\@prostojs/infact')
   * @returns
   */
  setReplaceRegistry(replace: TReplaceRegistry) {
    this.replace = { ...this.replace, ...replace }
    return this
  }

  /**
   * Register controllers (similar to @ImportController decorator)
   * @param controllers - list of target controllers (instances)
   * @returns
   */
  public registerControllers(
    ...controllers: Array<TObject | TFunction | [string, TObject | TFunction]>
  ) {
    this.unregisteredControllers.push(...controllers)
    return this
  }
}

export interface TMoostAdapterOptions<H, T> {
  prefix: string
  fakeInstance: T
  getInstance: () => Promise<T>
  method: keyof T
  handlers: Array<TMoostHandler<H>>
  getIterceptorHandler: () => Promise<InterceptorHandler>
  resolveArgs: () => Promise<unknown[]>
  logHandler: (eventName: string) => void
  register: (handler: TMoostHandler<TEmpty>, path: string, args: string[]) => void
}

export interface TMoostAdapter<H> {
  name: string
  bindHandler: <T extends TObject = TObject>(
    options: TMoostAdapterOptions<H, T>
  ) => void | Promise<void>
  onInit?: (moost: Moost) => void | Promise<void>
  getProvideRegistry?: () => TProvideRegistry
}
