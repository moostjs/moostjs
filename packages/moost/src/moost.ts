import { Wooks, TWooksOptions } from 'wooks'
import { bindControllerMethods } from './binding/bind-controller'
import { TInterceptorFn, TInterceptorPriority } from './decorators'
import { getMoostMate, TInterceptorData } from './metadata'
import { getConstructor, isConstructor, Mate } from '@prostojs/mate'
import { TPipeData, TPipeFn, TPipePriority } from './pipes/types'
import { TClassConstructor, TFunction, TObject } from './types'
import { logBright } from './utils/log'
import { panic } from './utils/panic'
import { createProvideRegistry, Infact, TProvideRegistry } from '@prostojs/infact'
import { getMoostInfact } from './metadata/infact'
import { sharedPipes } from './pipes/shared-pipes'
import { Valido } from '@prostojs/valido'
import { getMoostValido } from './metadata/valido'
import { WooksHttp } from '@wooksjs/event-http'

export interface TMoostOptions {
    globalPrefix?: string
    port?: number | string
    hostname?: string
    wooksOptions?: TWooksOptions
}

export class Moost {
    pipes: TPipeData[] = [...sharedPipes]

    interceptors: TInterceptorData[] = []

    provide: TProvideRegistry = createProvideRegistry(
        [Infact, getMoostInfact],
        [Mate, getMoostMate],
        [Valido, getMoostValido],
    )

    constructor(protected options?: TMoostOptions) {

    }

    protected wooksApp?: Wooks

    protected wooksHttp?: WooksHttp

    protected unregisteredControllers: (TObject | TFunction)[] = []

    public listen(): Promise<Wooks>

    public listen(port: number): Promise<Wooks>

    public listen(port: number, cb: () => void): Promise<Wooks>

    public listen(port: number, hostname: string): Promise<Wooks>

    public listen(port: number, hostname: string, cb: () => void): Promise<Wooks>

    public async listen(port?: number, hostname?: string | (() => void) , cb?: () => void): Promise<Wooks> {
        this.wooksApp = new Wooks()
        this.setProvideRegistry(createProvideRegistry([Wooks, () => this.wooksApp], [Moost, () => this]))
        const _port = Number(this.options?.port || port)
        const _hostname = this.options?.hostname || hostname
        if (!_port) {
            throw panic('Port is not specified for "listen" method')
        }
        await this.init()
        this.wooksHttp = new WooksHttp(_port, _hostname as string, cb as () => void)
        await this.wooksApp.subscribe(this.wooksHttp)
        logBright(`🚀 ${getConstructor(this).name} is up and running on port ${ _port }`)
        return this.wooksApp
    }

    public close() {
        return this.wooksHttp?.close()
    }

    private async init() {
        if (this.wooksApp) {
            this.unregisteredControllers.unshift(this)
            await this.bindControllers()
        }
    }

    protected async bindControllers() {
        if (this.wooksApp) {
            const meta = getMoostMate()
            const thisMeta = meta.read(this)
            const provide = { ...(thisMeta?.provide || {}), ...this.provide }
            for (const controller of this.unregisteredControllers) {
                await this.bindController(controller, provide, this.options?.globalPrefix || '')
            }
            this.unregisteredControllers = []
        }
    }

    protected async bindController(controller: TFunction | TObject, provide: TProvideRegistry, globalPrefix: string, replaceOwnPrefix?: string) {
        if (this.wooksApp) {
            const meta = getMoostMate()
            const classMeta = meta.read(controller)
            const infact = getMoostInfact()
            const isControllerConsructor = isConstructor(controller)

            let instance: TObject | undefined
            if (isControllerConsructor && classMeta?.injectable === 'SINGLETON') {
                instance = await infact.get(controller as (new () => unknown), provide) as Promise<TObject>
            } else if (!isControllerConsructor) {
                instance = controller
                infact.setProvideRegByInstance(instance, provide)
            }

            // getInstance - instance factory for resolving SINGLETON and FOR_REQUEST instance
            const getInstance = instance ? () => Promise.resolve(instance as TObject) : async (): Promise<TObject> => {
                // if (!instance) {
                infact.silent()
                const instance = await infact.get(controller as (new () => unknown), provide) as Promise<TObject>
                infact.silent(false)
                // }
                return instance
            }

            const classConstructor = isConstructor(controller) ? controller : getConstructor(controller) as TClassConstructor
            bindControllerMethods(getInstance, classConstructor, this.wooksApp, {
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
                            isConstr ? ic.typeResolver : isFunc ? await (ic.typeResolver as TFunction)() : ic.typeResolver,
                            ic.provide ? { ...mergedProvide, ...ic.provide } : mergedProvide,
                            `${globalPrefix}/${(prefix || '')}`,
                            ic.prefix,
                        )
                    }
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
