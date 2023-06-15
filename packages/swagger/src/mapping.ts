import { TControllerOverview } from 'moost'
import { TSwaggerMate } from './swagger.mate'
import { TZodMetadata, getZodTypeForProp, z } from '@moostjs/zod'
import { TZodParsed, parseZodType } from 'zod-parser'
import { TLogger } from 'common'

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

export function mapToSwaggerSpec(metadata: TControllerOverview[], options?: TSwaggerOptions, logger?: TLogger) {
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
                const paramIndex = handler.meta.params.findIndex(
                    param => param.paramSource === 'ROUTE' && param.paramName === paramName
                )
                const paramMeta = handler.meta.params[paramIndex]
                let schema
                if (paramMeta) {
                    const zodType = getZodTypeForProp({
                        type: controller.type,
                        key: handler.method,
                        index: paramIndex,
                    }, {
                        type: paramMeta.type,
                        additionalMeta: paramMeta as TZodMetadata,
                    }, undefined, logger)
                    schema = paramSchemaType(myParseZod(zodType))
                }

                endpointSpec.parameters.push({
                    name: paramName,
                    in: 'path',
                    description: paramMeta ? paramMeta.description : undefined,
                    required: !paramMeta || !paramMeta.optional,
                    schema: schema || { type: 'string' },
                })
            }

            for (let i = 0; i < handler.meta.params.length; i++) {
                const paramMeta = handler.meta.params[i]
                if (paramMeta.paramSource && ['QUERY_ITEM', 'QUERY'].includes(paramMeta.paramSource)) {
                    const zodType = getZodTypeForProp({
                        type: controller.type,
                        key: handler.method,
                        index: i,
                    }, {
                        type: paramMeta.type,
                        additionalMeta: paramMeta as TZodMetadata,
                    }, undefined, logger)
                    const parsed = myParseZod(zodType)
                    const schema = paramSchemaType(parsed)
                    if (paramMeta.paramSource == 'QUERY_ITEM') {
                        endpointSpec.parameters.push({
                            name: paramMeta.paramName || '',
                            in: 'query',
                            description: paramMeta.description,
                            required: paramMeta.required || false,
                            schema: schema || { type: 'string' },
                        })
                    } else if (paramMeta.paramSource == 'QUERY') {
                        if (parsed.$type === 'ZodObject') {
                            for (const [key, value] of Object.entries(parsed.$inner)) {
                                const schema = paramSchemaType(value)
                                if (schema) {
                                    const swaggerSchema = {
                                        name: key,
                                        in: 'query',
                                        description: (value as unknown as { description: string }).description,
                                        required: !parsed.$optional && !value.$optional,
                                        schema,
                                    }
                                    endpointSpec.parameters.push(swaggerSchema)
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    return swaggerSpec
}

function paramSchemaType(zodType: TZodParsed & { description?: string }) {
    let schema
    switch (zodType.$type) {
        case 'ZodAny':
        case 'ZodUnknown':
        case 'ZodString': schema = { type: 'string' }; break
        case 'ZodNumber': schema = { type: 'number' }; break
        case 'ZodBigInt': schema = { type: 'integer' }; break
        case 'ZodBoolean': schema = { type: 'boolean' }; break
        case 'ZodEnum': schema = { type: 'string', enum: zodType.$value }; break
        case 'ZodNativeEnum': schema = { type: 'string', enum: Object.keys(zodType.$value) }; break
        case 'ZodLiteral': schema = { type: 'string', enum: [zodType.$value] }; break
        default: return undefined
    }
    return schema
}

function myParseZod(schema: z.ZodType) {
    return parseZodType<TZodParsed & { description?: string }>(schema, (t, def) => {
        return {
            ...t,
            description: def.description,
        }
    })
}
