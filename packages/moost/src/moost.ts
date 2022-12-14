import { bindControllerMethods } from './binding/bind-controller'
import { TInterceptorFn, TInterceptorPriority } from './decorators'
import { getMoostMate, TInterceptorData } from './metadata'
import { getConstructor, isConstructor, Mate } from '@prostojs/mate'
import { TPipeData, TPipeFn, TPipePriority } from './pipes/types'
import { TAny, TClassConstructor, TFunction, TObject } from './types'
import { createProvideRegistry, Infact, TProvideRegistry } from '@prostojs/infact'
import { getMoostInfact } from './metadata/infact'
import { sharedPipes } from './pipes/shared-pipes'
import { Valido } from '@prostojs/valido'
import { getMoostValido } from './metadata/valido'
import { TMoostAdapter } from './adapter'

export interface TMoostOptions {
    globalPrefix?: string
}

export class Moost {
    pipes: TPipeData[] = [...sharedPipes]

    interceptors: TInterceptorData[] = []

    adapters: TMoostAdapter<TAny>[] = []

    provide: TProvideRegistry = createProvideRegistry(
        [Infact, getMoostInfact],
        [Mate, getMoostMate],
        [Valido, getMoostValido],
    )

    constructor(protected options?: TMoostOptions) {

    }

    public adapter<T extends object, A extends TMoostAdapter<T>>(a: A) {
        this.adapters.push(a)
        return a
    }

    protected unregisteredControllers: (TObject | TFunction)[] = []

    public async init() {
        this.setProvideRegistry(createProvideRegistry([Moost, () => this]))
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
            await (a.onInit && a.onInit())
        }
    }

    protected async bindControllers() {
        const meta = getMoostMate()
        const thisMeta = meta.read(this)
        const provide = { ...(thisMeta?.provide || {}), ...this.provide }
        for (const controller of this.unregisteredControllers) {
            await this.bindController(controller, provide, this.options?.globalPrefix || '')
        }
        this.unregisteredControllers = []
    }

    protected async bindController(controller: TFunction | TObject, provide: TProvideRegistry, globalPrefix: string, replaceOwnPrefix?: string) {
        const meta = getMoostMate()
        const classMeta = meta.read(controller)
        const infact = getMoostInfact()
        const isControllerConsructor = isConstructor(controller)

        let instance: TObject | undefined
        if (isControllerConsructor && (classMeta?.injectable === 'SINGLETON' || classMeta?.injectable === true)) {
            instance = await infact.get(controller as (new () => unknown), provide) as Promise<TObject>
        } else if (!isControllerConsructor) {
            instance = controller
            infact.setProvideRegByInstance(instance, provide)
        }

        // getInstance - instance factory for resolving SINGLETON and FOR_EVENT instance
        const getInstance = instance ? () => Promise.resolve(instance as TObject) : async (): Promise<TObject> => {
            // if (!instance) {
            infact.silent()
            const instance = await infact.get(controller as (new () => unknown), provide) as Promise<TObject>
            infact.silent(false)
            // }
            return instance
        }

        const classConstructor = isConstructor(controller) ? controller : getConstructor(controller) as TClassConstructor
        await bindControllerMethods({
            getInstance,
            classConstructor,
            adapters: this.adapters,
            globalPrefix,
            replaceOwnPrefix,
            interceptors: [...this.interceptors],
            pipes: [...this.pipes],
            provide: classMeta?.provide || {},
        })
        if (classMeta && classMeta.importController) {
            const prefix = typeof replaceOwnPrefix === 'string' ? replaceOwnPrefix : classMeta?.controller?.prefix
            const mergedProvide = {...provide, ...(classMeta?.provide || {})}                
            for (const ic of classMeta.importController) {
                if (ic.typeResolver) {
                    const isConstr = isConstructor(ic.typeResolver)
                    const isFunc = typeof ic.typeResolver === 'function'
                    await this.bindController(
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                        isConstr ? ic.typeResolver : isFunc ? await (ic.typeResolver as TFunction)() : ic.typeResolver,
                        ic.provide ? { ...mergedProvide, ...ic.provide } : mergedProvide,
                        `${globalPrefix}/${(prefix || '')}`,
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
        return this
    }

    applyGlobalInterceptors(...items: (TInterceptorData['handler'] | TInterceptorData)[]) {
        for (const item of items) {
            if (typeof item === 'function') {
                this.interceptors.push({
                    handler: item,
                    priority: typeof (item as TInterceptorFn).priority === 'number' ? (item as TInterceptorFn).priority as TInterceptorPriority : TInterceptorPriority.INTERCEPTOR,
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
        this.provide = {...this.provide, ...provide}
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
