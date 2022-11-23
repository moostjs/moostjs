import { Wooks } from 'wooks'
import { useHttpContext, useRequest } from '@wooksjs/event-http'
import { setComposableControllerContext } from '../composables/controller-meta'
import { TInterceptorAfter, TInterceptorBefore, TInterceptorFn, TInterceptorOnError } from '../decorators'
import { TMoostMetadata, TMoostParamsMetadata } from '../metadata'
import { getMoostInfact } from '../metadata/infact'
import { TPipeData } from '../pipes'
import { runPipes } from '../pipes/run-pipes'
import { TObject } from '../types'

export interface IBindHandlerOptions {
    httpMethod: Required<TMoostMetadata>['httpHandler'][0]['method']
    path: string
    interceptorHandlers: TInterceptorFn[]
    provide: Required<TMoostMetadata>['provide']
    argsMeta: TMoostParamsMetadata[]
    argsPipes: {
        meta: TMoostParamsMetadata
        pipes: TPipeData[]
    }[]
}

export function bindHandler<T extends TObject = TObject>(getInstance: () => Promise<T>, method: keyof T, wooksApp: Wooks, options: IBindHandlerOptions) {
    const pathBuilder = wooksApp.on(options.httpMethod, options.path, async () => {
        const { restoreCtx } = useHttpContext()
        const { reqId, rawRequest } = useRequest()
        const infact = getMoostInfact()
        const scopeId = reqId()
        infact.registerScope(scopeId)
        rawRequest.on('end', () => infact.unregisterScope(scopeId))

        const instance = await getInstance()
        restoreCtx()

        setComposableControllerContext({
            controller: instance,
            method: method as string,
            pathBuilder: pathBuilder as ReturnType<Wooks['on']>,
        })

        let response: unknown
        let responseOverwritten = false
        const before: TInterceptorBefore[] = []
        const after: TInterceptorAfter[] = []
        const onError: TInterceptorOnError[] = []
        function replyFn(reply: unknown) {
            response = reply
            responseOverwritten = true
        }

        // init interceptors
        for (const handler of options.interceptorHandlers) {
            restoreCtx()
            await handler((fn) => { before.push(fn) }, (fn) => { after.unshift(fn) }, (fn) => { onError.unshift(fn) })
        }

        // params
        let args: unknown[] = []
        try {
            restoreCtx()
            args = await applyPipesToArgs(options.argsPipes)
        } catch (e) {
            response = e
        }

        if (!response) {
            // fire before interceptors
            for (const handler of before) {
                restoreCtx()
                await handler(replyFn)
                if (responseOverwritten) break
            }

            // fire request handler
            if (!responseOverwritten) {
                try {
                    restoreCtx()
                    response = await (instance[method] as unknown as (...a: typeof args) => unknown)(...args)
                } catch (e) {
                    response = e
                }
            }
        }

        // fire after interceptors
        if (response instanceof Error) {
            for (const handler of onError) {
                restoreCtx()
                await handler(response, replyFn)
            }
        } else {
            for (const handler of after) {
                restoreCtx()
                await handler(response, replyFn)
            }
        }
        return response
    })
}

async function applyPipesToArgs(argsPipes: IBindHandlerOptions['argsPipes']): Promise<unknown[]> {
    const args: unknown[] = []
    const { restoreCtx } = useHttpContext()
    for (let i = 0; i < argsPipes.length; i++) {
        const {pipes, meta} = argsPipes[i]
        args[i] = await runPipes(pipes, meta, restoreCtx)
    }
    return args
}
