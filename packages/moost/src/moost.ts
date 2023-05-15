import { bindControllerMethods } from './binding/bind-controller'
import { TInterceptorFn, TInterceptorPriority } from './decorators'
import { getMoostMate, TInterceptorData } from './metadata'
import { getConstructor, isConstructor, Mate } from '@prostojs/mate'
import { TPipeData, TPipeFn, TPipePriority } from './pipes/types'
import { TAny, TClassConstructor, TFunction, TObject } from 'common'
import {
    createProvideRegistry,
    Infact,
    TProvideRegistry,
} from '@prostojs/infact'
import { getMoostInfact } from './metadata/infact'
import { sharedPipes } from './pipes/shared-pipes'
import { Valido } from '@prostojs/valido'
import { getMoostValido } from './metadata/valido'
import { TMoostAdapter } from './adapter'
import { useEventContext } from '@wooksjs/event-core'
import { ProstoLogger, TConsoleBase } from '@prostojs/logger'
import { getDefaultLogger } from 'common'

export interface TMoostOptions {
    globalPrefix?: string
    logger?: TConsoleBase
}

export class Moost {
    protected logger: TConsoleBase

    protected pipes: TPipeData[] = [...sharedPipes]

    protected interceptors: TInterceptorData[] = []

    protected adapters: TMoostAdapter<TAny>[] = []

    protected provide: TProvideRegistry = createProvideRegistry(
        [Infact, getMoostInfact],
        [Mate, getMoostMate],
        [Valido, getMoostValido]
    )

    protected unregisteredControllers: (TObject | TFunction)[] = []

    constructor(protected options?: TMoostOptions) {
        this.logger = options?.logger || getDefaultLogger('moost')
        getMoostInfact().setLogger(this.getLogger('infact'))
        const mate = getMoostMate()
        Object.assign(mate, { logger: this.getLogger('mate') })
    }

    public getLogger(topic: string) {
        if (this.logger instanceof ProstoLogger) {
            return this.logger.createTopic(topic)
        }
        return this.logger
    }

    public adapter<T>(a: TMoostAdapter<T>) {
        this.adapters.push(a)
        return a
    }

    public async init() {
        this.setProvideRegistry(createProvideRegistry([Moost, () => this]))
        for (const a of this.adapters) {
            const constructor = getConstructor(a)
            if (constructor) {
                this.setProvideRegistry(
                    createProvideRegistry([
                        constructor as TClassConstructor,
                        () => a,
                    ])
                )
            }
            if (typeof a.getProvideRegistry === 'function') {
                this.setProvideRegistry(a.getProvideRegistry())
            }
        }
        this.unregisteredControllers.unshift(this)
        await this.bindControllers()
        for (const a of this.adapters) {
            await (a.onInit && a.onInit())
        }
    }

    protected async bindControllers() {
        const infact = getMoostInfact()
        infact.setLogger(this.logger)
        const meta = getMoostMate()
        const thisMeta = meta.read(this)
        const provide = { ...(thisMeta?.provide || {}), ...this.provide }
        for (const controller of this.unregisteredControllers) {
            await this.bindController(
                controller,
                provide,
                this.options?.globalPrefix || ''
            )
        }
        this.unregisteredControllers = []
    }

    protected async bindController(
        controller: TFunction | TObject,
        provide: TProvideRegistry,
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
        const infactOpts = { provide, customData: { pipes } }
        if (
            isControllerConsructor &&
            (classMeta?.injectable === 'SINGLETON' ||
                classMeta?.injectable === true)
        ) {
            instance = (await infact.get(
                controller as TClassConstructor<TAny>,
                infactOpts
            )) as Promise<TObject>
        } else if (!isControllerConsructor) {
            instance = controller
            infact.setProvideRegByInstance(instance, provide)
        }

        // getInstance - instance factory for resolving SINGLETON and FOR_EVENT instance
        const getInstance = instance
            ? () => Promise.resolve(instance as TObject)
            : async (): Promise<TObject> => {
                // if (!instance) {
                infact.silent(true)
                const { restoreCtx } = useEventContext()
                const instance = (await infact.get(
                      controller as TClassConstructor<TAny>,
                      { ...infactOpts, syncContextFn: restoreCtx }
                )) as Promise<TObject>
                infact.silent(false)
                // }
                return instance
            }

        const classConstructor = isConstructor(controller)
            ? controller
            : (getConstructor(controller) as TClassConstructor)
        await bindControllerMethods({
            getInstance,
            classConstructor,
            adapters: this.adapters,
            globalPrefix,
            replaceOwnPrefix,
            interceptors: [...this.interceptors],
            pipes,
            provide: classMeta?.provide || {},
            logger: this.logger,
        })
        if (classMeta && classMeta.importController) {
            const prefix =
                typeof replaceOwnPrefix === 'string'
                    ? replaceOwnPrefix
                    : classMeta?.controller?.prefix
            const mergedProvide = { ...provide, ...(classMeta?.provide || {}) }
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
                        ic.provide
                            ? { ...mergedProvide, ...ic.provide }
                            : mergedProvide,
                        `${globalPrefix}/${prefix || ''}`,
                        ic.prefix
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
                    priority:
                        typeof item.priority === 'number'
                            ? item.priority
                            : TPipePriority.TRANSFORM,
                })
            } else {
                this.pipes.push({
                    handler: item.handler,
                    priority: item.priority,
                })
            }
        }
        return this
    }

    applyGlobalInterceptors(
        ...items: (TInterceptorData['handler'] | TInterceptorData)[]
    ) {
        for (const item of items) {
            if (typeof item === 'function') {
                this.interceptors.push({
                    handler: item,
                    priority:
                        typeof (item as TInterceptorFn).priority === 'number'
                            ? ((item as TInterceptorFn)
                                .priority as TInterceptorPriority)
                            : TInterceptorPriority.INTERCEPTOR,
                })
            } else {
                this.interceptors.push({
                    handler: item.handler,
                    priority: item.priority,
                })
            }
        }
        return this
    }

    /**
     * Register new entried to provide as dependency injections
     * @param provide - Provide Registry (use createProvideRegistry from '\@prostojs/infact')
     * @returns
     */
    setProvideRegistry(provide: TProvideRegistry) {
        this.provide = { ...this.provide, ...provide }
        return this
    }

    /**
     * Register controllers (similar to @ImportController decorator)
     * @param controllers - list of target controllers (instances)
     * @returns
     */
    public registerControllers(...controllers: (TObject | TFunction)[]) {
        this.unregisteredControllers.push(...controllers)
        return this
    }
}
