import {
    Moost,
    TMoostAdapter,
    TMoostAdapterOptions,
    defineMoostEventHandler,
    getMoostInfact,
} from 'moost'
import {
    WooksWf,
    TWooksWfOptions,
    createWfApp,
    TStepHandler,
} from '@wooksjs/event-wf'

import { getWfMate } from './meta-types'
import { useEventId } from '@wooksjs/event-core'
import { TFlowOutput, TWorkflowSpy } from '@prostojs/wf'

export interface TWfHandlerMeta {
    path: string
}

export interface TMoostWfOpts<T> {
    /**
     * wooksWf options or instance
     */
    wooksWf?: WooksWf<T> | TWooksWfOptions
    /**
     * more internal logs are printed when true
     */
    debug?: boolean
}

const LOGGER_TITLE = 'moost-wf'
const CONTEXT_TYPE = 'WF'

export class MoostWf<T> implements TMoostAdapter<TWfHandlerMeta> {
    protected wfApp: WooksWf<T>

    constructor(protected opts?: TMoostWfOpts<T>) {
        const wfAppOpts = opts?.wooksWf
        if (wfAppOpts && wfAppOpts instanceof WooksWf) {
            this.wfApp = wfAppOpts
        } else if (wfAppOpts) {
            this.wfApp = createWfApp(wfAppOpts)
        } else {
            this.wfApp = createWfApp()
        }
        if (!opts?.debug) {
            getMoostInfact().silent(true)
        }
    }

    async onNotFound() {
        const response = await defineMoostEventHandler({
            loggerTitle: LOGGER_TITLE,
            getIterceptorHandler: () => this.moost?.getGlobalInterceptorHandler(),
            getControllerInstance: () => this.moost,
            callControllerMethod: () => undefined,
            logErrors: this.opts?.debug,
        })()
        return response
    }

    protected moost?: Moost

    protected toInit: (() => void)[] = []

    onInit(moost: Moost) {
        this.moost = moost
        this.toInit.forEach(fn => fn())
    }

    getWfApp() {
        return this.wfApp
    }

    public attachSpy<I>(fn: TWorkflowSpy<T, I>) {
        return this.wfApp.attachSpy<I>(fn)
    }

    public detachSpy<I>(fn: TWorkflowSpy<T, I>) {
        return this.wfApp.detachSpy<I>(fn)
    }

    public start<I>(schemaId: string, initialContext: T, input?: I): Promise<TFlowOutput<T, I>> {
        return this.wfApp.start(schemaId, initialContext, input, () => {}, () => {
            const scopeId = useEventId().getId()
            getMoostInfact().unregisterScope(scopeId)
        })
    }

    public resume<I>(schemaId: string, state: { context: T, indexes: number[] }, input?: I): Promise<TFlowOutput<T, I>> {
        return this.wfApp.resume(schemaId, state, input, () => {}, () => {
            const scopeId = useEventId().getId()
            getMoostInfact().unregisterScope(scopeId)
        })
    }

    bindHandler<T extends object = object>(
        opts: TMoostAdapterOptions<TWfHandlerMeta, T>
    ): void {
        let fn
        for (const handler of opts.handlers) {
            if (!(['WF_STEP', 'WF_FLOW'].includes(handler.type))) continue
            const schemaId = handler.path
            const path =
                typeof schemaId === 'string'
                    ? schemaId
                    : typeof opts.method === 'string'
                        ? opts.method
                        : ''
            const targetPath = `${opts.prefix || ''}/${path}`.replace(
                /\/\/+/g,
                '/'
            ) + `${path.endsWith('//') ? '/' : ''}` // explicit double slash "//" -> force url to end with slash
            if (!fn) {
                fn = defineMoostEventHandler({
                    contextType: CONTEXT_TYPE,
                    loggerTitle: LOGGER_TITLE,
                    getIterceptorHandler: opts.getIterceptorHandler,
                    getControllerInstance: opts.getInstance,
                    controllerMethod: opts.method,
                    resolveArgs: opts.resolveArgs,
                    manualUnscope: true,
                })
            }
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
                const _fn = fn as (() => void)
                this.toInit.push(() => {
                    this.wfApp.flow(targetPath, wfSchema || [], _fn)
                    opts.logHandler(`${__DYE_CYAN__}(${handler.type})${__DYE_GREEN__}${targetPath}`) 
                })
            }
        }
    }
}
