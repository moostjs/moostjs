/* eslint-disable id-length */
/* eslint-disable max-depth */
import type { TMoostZodType, TZodMetadata } from '@moostjs/zod'
import { getZodType, getZodTypeForProp, z } from '@moostjs/zod'
import type { TControllerOverview } from 'moost'
import type { TZodParsed } from 'zod-parser'
import { parseZodType } from 'zod-parser'

import type { TAny, TLogger } from './common-types'
import type { TSwaggerConfigType, TSwaggerMate } from './swagger.mate'
import { getSwaggerMate } from './swagger.mate'

interface TEndpointSpec {
  summary?: string
  tags: string[]
  operationId?: string
  description?: string
  responses?: Record<
    string,
    {
      description?: string
      content: Record<string, { schema: TSwaggerSchema }>
    }
  >
  parameters: Array<{
    name: string
    in: string
    description?: string
    required: boolean
    schema: TSwaggerSchema
  }>
  requestBody?: {
    required?: boolean
    content: Record<string, { schema: TSwaggerSchema }>
  }
}

export interface TSwaggerOptions {
  title?: string
  description?: string
  version?: string
  cors?: boolean | string
}

export interface TSwaggerSchema {
  type?: string
  $ref?: string
  title?: string
  description?: string
  format?: string
  default?: unknown
  enum?: string[]
  nullable?: boolean
  readOnly?: boolean
  writeOnly?: boolean
  example?: unknown
  minLength?: number
  maxLength?: number
  pattern?: string
  minimum?: number
  maximum?: number
  exclusiveMinimum?: number
  exclusiveMaximum?: number
  multipleOf?: number
  items?: TSwaggerSchema | TSwaggerSchema[]
  minItems?: number
  maxItems?: number
  uniqueItems?: boolean
  properties?: Record<string, TSwaggerSchema>
  additionalProperties?: boolean | TSwaggerSchema
  required?: string[]
  allOf?: TSwaggerSchema[]
  anyOf?: TSwaggerSchema[]
  oneOf?: TSwaggerSchema[]
  not?: TSwaggerSchema
}

export function mapToSwaggerSpec(
  metadata: TControllerOverview[],
  options?: TSwaggerOptions,
  logger?: TLogger
) {
  const swaggerSpec = {
    openapi: '3.0.0',
    info: {
      title: options?.title || 'API Documentation',
      version: options?.version || '1.0.0',
    },
    paths: {} as Record<string, Record<string, TEndpointSpec>>,
    tags: [],
    components: {
      schemas: globalSchemas,
    },
  }

  for (const controller of metadata) {
    const cmeta = controller.meta as (TControllerOverview['meta'] & TSwaggerMate) | undefined
    if (cmeta?.swaggerExclude) {
      continue
    }

    const controllerTags = cmeta?.swaggerTags || []

    for (const handler of controller.handlers) {
      const hmeta = handler.meta as (TControllerOverview['meta'] & TSwaggerMate) | undefined
      const hh = handler.handler as typeof handler.handler & { method?: string }
      if (hh.type !== 'HTTP' || hmeta?.swaggerExclude || handler.registeredAs.length === 0) {
        continue
      }

      const uniqueParams: Record<string, TEndpointSpec['parameters'][number] | undefined> = {}

      const handlerPath = handler.registeredAs[0].path
      const handlerMethod = hh.method?.toLowerCase() || 'get'
      const handlerDescription = hmeta?.description
      const handlerTags = [...controllerTags, ...(hmeta?.swaggerTags || [])]

      if (!swaggerSpec.paths[handlerPath]) {
        swaggerSpec.paths[handlerPath] = {}
      }

      let responses: TEndpointSpec['responses'] | undefined

      if (hmeta?.swaggerResponses) {
        for (const [code, responseConfigs] of Object.entries(hmeta.swaggerResponses)) {
          const newCode = code === '0' ? getDefaultStatusCode(handlerMethod) : code
          for (const [contentType, conf] of Object.entries(responseConfigs)) {
            const { response, example } = conf
            const schema = getSwaggerSchemaFromSwaggerConfigType(response)
            if (schema) {
              responses = responses || {}
              responses[newCode] = {
                content: {
                  [contentType]: { schema: { ...schema, example: example || schema.example } },
                },
              }
            }
          }
        }
      } else if (hmeta?.returnType) {
        const parsed = myParseZod(
          getZodType({
            type: hmeta.returnType,
          })
        )
        if (
          ['ZodString', 'ZodNumber', 'ZodObject', 'ZodArray', 'ZodBoolean'].includes(parsed.$type)
        ) {
          const schema = getSwaggerSchema(parsed)
          if (schema) {
            responses = responses || {}
            responses[getDefaultStatusCode(handlerMethod)] = {
              content: {
                '*/*': {
                  schema,
                },
              },
            }
          }
        }
      }

      let reqBodyRequired = true
      const bodyConfig: Record<string, { schema: TSwaggerSchema | undefined }> = {}

      if (hmeta?.swaggerRequestBody) {
        for (const [contentType, type] of Object.entries(hmeta.swaggerRequestBody)) {
          let zt: z.ZodType | undefined
          let schema: TSwaggerSchema | undefined
          if (type instanceof z.ZodType) {
            zt = type
          } else if (typeof type === 'function') {
            zt = getZodType({
              type,
            })
          }
          if (zt) {
            const parsed = myParseZod(zt)
            if (
              ['ZodString', 'ZodNumber', 'ZodObject', 'ZodArray', 'ZodBoolean'].includes(
                parsed.$type
              )
            ) {
              schema = getSwaggerSchema(parsed)
            }
          }
          bodyConfig[contentType] = { schema }
        }
      }

      swaggerSpec.paths[handlerPath][handlerMethod] = {
        summary: handlerDescription,
        operationId: `${handlerMethod.toUpperCase()}_${handlerPath
          .replace(/\//g, '_')
          .replace(/[{}]/g, '__')
          .replace(/[^\dA-Za-z]/g, '_')}`,
        tags: handlerTags,
        parameters: [],
        responses,
      }

      const endpointSpec = swaggerSpec.paths[handlerPath][handlerMethod]

      // eslint-disable-next-line no-inner-declarations
      function addParam(param: TEndpointSpec['parameters'][number]) {
        const key = `${param.in}//${param.name}`
        if (uniqueParams[key]) {
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          uniqueParams[key]!.description = param.description ?? uniqueParams[key]!.description
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          uniqueParams[key]!.required = param.required
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition, @typescript-eslint/no-non-null-assertion
          uniqueParams[key]!.schema = param.schema ?? uniqueParams[key]!.schema
        } else {
          uniqueParams[key] = param
          endpointSpec.parameters.push(param)
        }
      }

      for (const param of cmeta?.swaggerParams || []) {
        addParam({
          name: param.name,
          in: param.in,
          description: param.description,
          required: !!param.required,
          schema: getSwaggerSchemaFromSwaggerConfigType(param.type) || { type: 'string' },
        })
      }

      for (const param of hmeta?.swaggerParams || []) {
        addParam({
          name: param.name,
          in: param.in,
          description: param.description,
          required: !!param.required,
          schema: getSwaggerSchemaFromSwaggerConfigType(param.type) || { type: 'string' },
        })
      }

      for (const paramName of handler.registeredAs[0].args) {
        const paramIndex = handler.meta.params.findIndex(
          param => param.paramSource === 'ROUTE' && param.paramName === paramName
        )
        const paramMeta = handler.meta.params[paramIndex]
        let schema
        let parsed
        if (paramMeta) {
          const zodType = getZodTypeForProp(
            {
              type: controller.type,
              key: handler.method,
              index: paramIndex,
            },
            {
              type: paramMeta.type,
              additionalMeta: paramMeta as TZodMetadata,
            },
            undefined,
            logger
          )
          parsed = myParseZod(zodType)
          schema = getSwaggerSchema(parsed, true)
        }

        addParam({
          name: paramName,
          in: 'path',
          description: paramMeta ? paramMeta.description : undefined,
          required: !paramMeta.optional && !parsed?.$optional,
          schema: schema || { type: 'string' },
        })
      }

      for (let i = 0; i < handler.meta.params.length; i++) {
        const paramMeta = handler.meta.params[i]
        if (paramMeta.paramSource && ['QUERY_ITEM', 'QUERY'].includes(paramMeta.paramSource)) {
          const zodType = getZodTypeForProp(
            {
              type: controller.type,
              key: handler.method,
              index: i,
            },
            {
              type: paramMeta.type,
              additionalMeta: paramMeta as TZodMetadata,
            },
            undefined,
            logger
          )
          const parsed = myParseZod(zodType)
          const schema = getSwaggerSchema(parsed, true)
          if (paramMeta.paramSource === 'QUERY_ITEM') {
            endpointSpec.parameters.push({
              name: paramMeta.paramName || '',
              in: 'query',
              description: paramMeta.description,
              required: !paramMeta.optional && !parsed.$optional,
              schema: schema || { type: 'string' },
            })
          } else if (paramMeta.paramSource === 'QUERY' && parsed.$type === 'ZodObject') {
            for (const [key, value] of Object.entries(parsed.$inner)) {
              const schema = getSwaggerSchema(value, true)
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
        if (paramMeta.paramSource === 'BODY') {
          const zodType = getZodTypeForProp(
            {
              type: controller.type,
              key: handler.method,
              index: i,
            },
            {
              type: paramMeta.type,
              additionalMeta: paramMeta as TZodMetadata,
            },
            undefined,
            logger
          )
          const parsed = myParseZod(zodType)
          let contentType = ''
          switch (parsed.$type) {
            case 'ZodString':
            case 'ZodNumber':
            case 'ZodBigInt':
            case 'ZodBoolean':
            case 'ZodDate':
            case 'ZodEnum':
            case 'ZodNativeEnum':
            case 'ZodLiteral': {
              contentType = 'text/plan'
              break
            }
            default: {
              contentType = 'application/json'
            }
          }
          if (!bodyConfig[contentType]) {
            bodyConfig[contentType] = { schema: getSwaggerSchema(parsed) }
          }
          reqBodyRequired = !zodType.isOptional() && !paramMeta.optional
        }
      }
      if (bodyConfig && Object.entries(bodyConfig).some(e => !!e[1])) {
        swaggerSpec.paths[handlerPath][handlerMethod].requestBody = {
          content: bodyConfig as Record<string, { schema: TSwaggerSchema }>,
          required: reqBodyRequired,
        }
      }
    }
  }

  return swaggerSpec
}

const globalSchemas: Record<string, TSwaggerSchema> = {}

function getSwaggerSchema(parsed: TZodParsed, forParam?: boolean): TSwaggerSchema | undefined {
  const zodType = parsed.$ref as TMoostZodType
  const meta = zodType.__type_ref ? getSwaggerMate().read(zodType.__type_ref) : undefined
  if (!forParam && zodType.__type_ref && globalSchemas[zodType.__type_ref.name]) {
    return { $ref: `#/components/schemas/${zodType.__type_ref.name}` }
  }
  if (forParam && zodType.__type_ref && globalSchemas[zodType.__type_ref.name]) {
    return globalSchemas[zodType.__type_ref.name]
  }

  const schema: TSwaggerSchema = {}

  if (meta) {
    if (meta.swaggerExample) {
      schema.example = meta.swaggerExample
    }
    if (meta.label || meta.id) {
      schema.title = meta.label || meta.id
    }
    if (meta.description) {
      schema.description = meta.description
    }
  }

  if (!forParam && zodType.__type_ref) {
    globalSchemas[zodType.__type_ref.name] = schema
  }
  function asString() {
    schema.type = 'string'
    if (parsed.$checks) {
      const { regex } = parsed.$checks as { regex?: RegExp }
      if (regex) {
        schema.pattern = regex.source
      }
    }
  }

  function asLiteral() {
    if (parsed.$type === 'ZodLiteral') {
      schema.type = 'string'
      schema.enum = [parsed.$value]
    }
  }
  function asEnum() {
    if (parsed.$type === 'ZodEnum') {
      schema.type = 'string'
      schema.enum = parsed.$value
    }
  }
  function asNativeEnum() {
    if (parsed.$type === 'ZodNativeEnum') {
      schema.type = 'string'
      schema.enum = Object.keys(parsed.$value)
    }
  }
  if (forParam) {
    switch (parsed.$type) {
      case 'ZodAny':
      case 'ZodUnknown':
      case 'ZodString': {
        asString()
        break
      }
      case 'ZodNumber': {
        schema.type = 'number'
        break
      }
      case 'ZodBigInt': {
        schema.type = 'integer'
        break
      }
      case 'ZodBoolean': {
        schema.type = 'boolean'
        break
      }
      case 'ZodLiteral': {
        asLiteral()
        break
      }
      case 'ZodEnum': {
        asEnum()
        break
      }
      case 'ZodNativeEnum': {
        asNativeEnum()
        break
      }
      case 'ZodDate': {
        schema.type = 'string'
        break
      }
      case 'ZodNull': {
        schema.type = 'null'
        break
      }
      default: {
        return undefined
      }
    }
  } else {
    // eslint-disable-next-line @typescript-eslint/switch-exhaustiveness-check
    switch (parsed.$type) {
      case 'ZodString': {
        asString()
        break
      }
      case 'ZodNumber': {
        schema.type = 'number'
        break
      }
      case 'ZodBigInt': {
        schema.type = 'integer'
        break
      }
      case 'ZodBoolean': {
        schema.type = 'boolean'
        break
      }
      case 'ZodLiteral': {
        asLiteral()
        break
      }
      case 'ZodEnum': {
        asEnum()
        break
      }
      case 'ZodNativeEnum': {
        asNativeEnum()
        break
      }
      case 'ZodDate': {
        schema.type = 'string'
        break
      }
      case 'ZodNull': {
        schema.type = 'null'
        break
      }
      case 'ZodFunction':
      case 'ZodSymbol':
      case 'ZodUndefined':
      case 'ZodUnknown':
      case 'ZodNever':
      case 'ZodVoid':
      case 'ZodNaN': {
        return undefined
      }
      // case 'ZodAny':
      case 'ZodArray': {
        schema.type = 'array'
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        schema.minItems = (parsed.$checks?.minLength as number) || undefined
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        schema.maxItems = (parsed.$checks?.maxLength as number) || undefined
        schema.items = getSwaggerSchema(parsed.$inner)
        break
      }
      case 'ZodTuple': {
        schema.type = 'array'
        schema.items = parsed.$inner
          .map(t => getSwaggerSchema(t))
          .filter(t => !!t) as TSwaggerSchema[]
        break
      }
      case 'ZodObject': {
        schema.type = 'object'
        schema.properties = {}
        schema.required = []
        if ((zodType as z.ZodObject<TAny>)._def.unknownKeys === 'passthrough') {
          schema.additionalProperties = {}
        }
        for (const [key, val] of Object.entries(parsed.$inner)) {
          const prop = getSwaggerSchema(val)
          if (prop) {
            schema.properties[key] = prop
            if (!val.$optional) {
              schema.required.push(key)
            }
          }
        }
        break
      }
      case 'ZodPromise':
      case 'ZodRecord':
      case 'ZodMap':
      case 'ZodSet': {
        schema.type = 'object'
        schema.properties = {}
        schema.additionalProperties = parsed.$type === 'ZodRecord' ? {} : undefined
        break
      }
      case 'ZodUnion':
      case 'ZodDiscriminatedUnion': {
        schema.oneOf = parsed.$inner
          .map(t => getSwaggerSchema(t))
          .filter(t => !!t) as TSwaggerSchema[]
        break
      }
      case 'ZodIntersection': {
        schema.allOf = parsed.$inner
          .map(t => getSwaggerSchema(t))
          .filter(t => !!t) as TSwaggerSchema[]
        break
      }
      case 'ZodLazy': {
        return getSwaggerSchema(parsed.$get())
      }
      default: {
        return undefined
      }
    }
  }

  if (parsed.$nullable) {
    schema.nullable = parsed.$nullable
  }
  if ((parsed.$ref as z.ZodString)._def.description!) {
    schema.description = (parsed.$ref as z.ZodString)._def.description!
  }
  if (parsed.$checks) {
    const checks = parsed.$checks as { min?: number; max?: number }
    if (parsed.$type === 'ZodString') {
      if (typeof checks.min === 'number') {
        schema.minLength = checks.min
      }
      if (typeof checks.max === 'number') {
        schema.maxLength = checks.max
      }
    } else {
      if (typeof checks.min === 'number') {
        schema.minimum = checks.min
      }
      if (typeof checks.max === 'number') {
        schema.maximum = checks.max
      }
    }
  }

  if (!forParam && zodType.__type_ref) {
    return { $ref: `#/components/schemas/${zodType.__type_ref.name}` }
  }
  return schema
}

function myParseZod(schema: TMoostZodType) {
  return parseZodType(schema)
}

function getDefaultStatusCode(httpMethod: string) {
  const defaultStatusCodes = {
    GET: 200,
    PUT: 200,
    POST: 201,
    DELETE: 204,
  }

  return defaultStatusCodes[httpMethod.toUpperCase() as keyof typeof defaultStatusCodes] || 200
}

function getSwaggerSchemaFromSwaggerConfigType(type?: TSwaggerConfigType) {
  let schema: TSwaggerSchema | undefined
  let zt: z.ZodType | undefined
  if (type instanceof z.ZodType) {
    zt = type
  } else if (typeof type === 'function') {
    zt = getZodType({
      type,
    })
  }
  if (zt) {
    const parsed = myParseZod(zt)
    if (['ZodString', 'ZodNumber', 'ZodObject', 'ZodArray', 'ZodBoolean'].includes(parsed.$type)) {
      schema = getSwaggerSchema(parsed)
    }
  } else if ((type as TSwaggerSchema).type || (type as TSwaggerSchema).$ref) {
    schema = type as TSwaggerSchema
  }
  return schema
}
