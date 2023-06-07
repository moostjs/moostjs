import { TControllerOverview } from 'moost'
import { TSwaggerMate } from './swagger.mate'

interface TEndpointSpec {
    summary?: string
    tags: string[]
    parameters: {
        name: string
        in: string
        description?: string
        required: boolean
        schema: Record<string, unknown>
    }[]
}

interface TSwaggerOptions {
    title?: string
    description?: string
    version?: string
}

export function mapToSwaggerSpec(metadata: TControllerOverview[], options?: TSwaggerOptions) {
    const swaggerSpec = {
        openapi: '3.0.0',
        info: {
            title: options?.title || 'API Documentation',
            version: options?.version || '1.0.0',
        },
        paths: {} as Record<string, Record<string, TEndpointSpec>>,
        tags: [],
    }

    for (const controller of metadata) {
        const cmeta = controller.meta as ((TControllerOverview['meta'] & TSwaggerMate) | undefined)
        if (cmeta?.swaggerExclude) continue

        const controllerTags = cmeta?.swaggerTags || []

        for (const handler of controller.handlers) {
            const hmeta = handler.meta as ((TControllerOverview['meta'] & TSwaggerMate) | undefined)
            const hh = handler.handler as (typeof handler.handler & { method?: string })
            if (hh.type !== 'HTTP' || hmeta?.swaggerExclude || !handler.registeredAs.length) continue

            const handlerPath = handler.registeredAs[0].path
            const handlerMethod = hh.method?.toLowerCase() || 'get'
            const handlerDescription = hmeta?.description
            const handlerTags = [...controllerTags, ...(hmeta?.swaggerTags || [])]

            if (!swaggerSpec.paths[handlerPath]) {
                swaggerSpec.paths[handlerPath] = {}
            }

            swaggerSpec.paths[handlerPath][handlerMethod] = {
                summary: handlerDescription,
                tags: handlerTags,
                parameters: [],
            }

            const endpointSpec = swaggerSpec.paths[handlerPath][handlerMethod]

            for (const paramName of handler.registeredAs[0].args) {
                const paramMeta = handler.meta.params.find(
                    param => param.isRouteParam === paramName
                )

                endpointSpec.parameters.push({
                    name: paramName,
                    in: 'path',
                    description: paramMeta ? paramMeta.description : undefined,
                    required: paramMeta ? paramMeta.required || false : false,
                    schema: { type: 'string' }, // assuming string type, adjust as needed
                })
            }

            for (const paramMeta of handler.meta.params) {
                if (!paramMeta.isQueryParam) continue

                endpointSpec.parameters.push({
                    name: paramMeta.isQueryParam,
                    in: 'query',
                    description: paramMeta.description,
                    required: paramMeta.required || false,
                    schema: { type: 'string' }, // assuming string type, adjust as needed
                })
            }
        }
    }

    return swaggerSpec
}
