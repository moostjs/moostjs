import type { TControllerOverview } from 'moost'

import type { TLogger } from './common-types'
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
  parameters: {
    name: string
    in: string
    description?: string
    required: boolean
    schema: TSwaggerSchema
  }[]
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
  const?: unknown
}

interface SchemaEnsureResult {
  schema: TSwaggerSchema
  ref?: string
  componentName?: string
  isComponent: boolean
}

type SchemaResolution =
  | {
      kind: 'component'
      schema: TSwaggerSchema
      typeRef: object
      suggestedName?: string
    }
  | {
      kind: 'inline'
      schema: TSwaggerSchema
    }

const globalSchemas: Record<string, TSwaggerSchema> = {}
let schemaRefs = new WeakMap<object, string>()
const nameToType = new Map<string, object>()

export function mapToSwaggerSpec(
  metadata: TControllerOverview[],
  options?: TSwaggerOptions,
  logger?: TLogger,
) {
  resetSchemaRegistry()
  void logger

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
            const schema = resolveSwaggerSchemaFromConfig(response)
            if (schema) {
              responses = responses || {}
              const schemaWithExample = example !== undefined ? { ...schema, example } : schema
              responses[newCode] = {
                content: {
                  [contentType]: { schema: schemaWithExample },
                },
              }
            }
          }
        }
      } else if (hmeta?.returnType) {
        const ensured = ensureSchema(hmeta.returnType)
        const schema = toSchemaOrRef(ensured)
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

      let reqBodyRequired = true
      const bodyContent: Record<string, { schema: TSwaggerSchema }> = {}

      if (hmeta?.swaggerRequestBody) {
        for (const [contentType, type] of Object.entries(hmeta.swaggerRequestBody)) {
          const schema = resolveSwaggerSchemaFromConfig(type)
          if (schema) {
            bodyContent[contentType] = { schema }
          }
        }
      }

      swaggerSpec.paths[handlerPath][handlerMethod] = {
        summary: handlerDescription,
        operationId: `${handlerMethod.toUpperCase()}_${handlerPath
          .replaceAll(/\//g, '_')
          .replaceAll(/[{}]/g, '__')
          .replaceAll(/[^\dA-Za-z]/g, '_')}`,
        tags: handlerTags,
        parameters: [],
        responses,
      }

      const endpointSpec = swaggerSpec.paths[handlerPath][handlerMethod]

      function addParam(param: TEndpointSpec['parameters'][number]) {
        const key = `${param.in}//${param.name}`
        if (uniqueParams[key]) {
          uniqueParams[key]!.description = param.description ?? uniqueParams[key]!.description
          uniqueParams[key]!.required = param.required
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
          schema: resolveSwaggerSchemaFromConfig(param.type) || { type: 'string' },
        })
      }

      for (const param of hmeta?.swaggerParams || []) {
        addParam({
          name: param.name,
          in: param.in,
          description: param.description,
          required: !!param.required,
          schema: resolveSwaggerSchemaFromConfig(param.type) || { type: 'string' },
        })
      }

      for (const paramName of handler.registeredAs[0].args) {
        const paramIndex = handler.meta.params.findIndex(
          (param) => param.paramSource === 'ROUTE' && param.paramName === paramName,
        )
        const paramMeta = handler.meta.params[paramIndex]
        const ensured = ensureSchema(paramMeta?.type)
        const schema = toSchemaOrRef(ensured) || { type: 'string' }

        addParam({
          name: paramName,
          in: 'path',
          description: paramMeta ? paramMeta.description : undefined,
          required: !paramMeta?.optional,
          schema,
        })
      }

      for (const paramMeta of handler.meta.params) {
        if (paramMeta.paramSource && ['QUERY_ITEM', 'QUERY'].includes(paramMeta.paramSource)) {
          const ensured = ensureSchema(paramMeta.type)
          if (paramMeta.paramSource === 'QUERY_ITEM') {
            const schema = toSchemaOrRef(ensured)
            const normalized = schema ? normalizeQueryParamSchema(schema) : undefined
            endpointSpec.parameters.push({
              name: paramMeta.paramName || '',
              in: 'query',
              description: paramMeta.description,
              required: !paramMeta.optional,
              schema: normalized || { type: 'string' },
            })
          } else if (paramMeta.paramSource === 'QUERY') {
            const schema = ensured?.schema
            if (schema?.type === 'object' && schema.properties) {
              const requiredProps = new Set(schema.required || [])
              for (const [key, value] of Object.entries(schema.properties)) {
                const propertySchema = cloneSchema(value)
                const normalizedProperty = normalizeQueryParamSchema(propertySchema)
                if (normalizedProperty) {
                  endpointSpec.parameters.push({
                    name: key,
                    in: 'query',
                    description: (normalizedProperty as { description?: string }).description,
                    required: !paramMeta.optional && requiredProps.has(key),
                    schema: normalizedProperty,
                  })
                }
              }
            } else if (ensured) {
              const schema = toSchemaOrRef(ensured)
              const normalized = schema ? normalizeQueryParamSchema(schema) : undefined
              endpointSpec.parameters.push({
                name: paramMeta.paramName || '',
                in: 'query',
                description: paramMeta.description,
                required: !paramMeta.optional,
                schema: normalized || { type: 'string' },
              })
            }
          }
        }
        if (paramMeta.paramSource === 'BODY') {
          const ensured = ensureSchema(paramMeta.type)
          const schema = toSchemaOrRef(ensured)
          if (schema) {
            const contentType = inferBodyContentType(schema, ensured?.schema)
            if (!bodyContent[contentType]) {
              bodyContent[contentType] = { schema }
            }
            reqBodyRequired = !paramMeta.optional
          }
        }
      }

      const bodyEntries = Object.entries(bodyContent).filter(
        (entry) => entry[1] && entry[1].schema !== undefined,
      )
      if (bodyEntries.length > 0) {
        const content: Record<string, { schema: TSwaggerSchema }> = {}
        for (const [contentType, { schema }] of bodyEntries) {
          content[contentType] = { schema }
        }
        endpointSpec.requestBody = {
          content,
          required: reqBodyRequired,
        }
      }
    }
  }

  return swaggerSpec
}

function resolveSwaggerSchemaFromConfig(type?: TSwaggerConfigType) {
  if (type === undefined) {
    return undefined
  }
  const ensured = ensureSchema(type)
  return toSchemaOrRef(ensured)
}

function toSchemaOrRef(result?: SchemaEnsureResult): TSwaggerSchema | undefined {
  if (!result) {
    return undefined
  }
  if (result.ref) {
    return { $ref: result.ref }
  }
  return cloneSchema(result.schema)
}

function inferBodyContentType(schema: TSwaggerSchema, resolved?: TSwaggerSchema) {
  const target = resolved ?? resolveSchemaFromRef(schema)
  const schemaType = target?.type ?? schema.type
  if (schemaType && ['string', 'number', 'integer', 'boolean'].includes(schemaType)) {
    return 'text/plain'
  }
  return 'application/json'
}

const SIMPLE_QUERY_TYPES = new Set(['string', 'number', 'integer', 'boolean'])

function normalizeQueryParamSchema(schema: TSwaggerSchema) {
  const target = resolveSchemaFromRef(schema) || schema
  if (!target) {
    return undefined
  }
  if (target.type === 'array') {
    return isArrayOfSimpleItems(target.items) ? schema : undefined
  }
  return isSimpleSchema(schema) ? schema : undefined
}

function isArrayOfSimpleItems(items: TSwaggerSchema | TSwaggerSchema[] | undefined) {
  if (!items) {
    return false
  }
  if (Array.isArray(items)) {
    if (items.length === 0) {
      return false
    }
    return items.every((entry) => isSimpleSchema(entry))
  }
  return isSimpleSchema(items)
}

function isSimpleSchema(schema: TSwaggerSchema | undefined, seen = new Set<TSwaggerSchema>()) {
  if (!schema) {
    return false
  }
  if (seen.has(schema)) {
    return false
  }
  seen.add(schema)
  if (schema.$ref) {
    const resolved = resolveSchemaFromRef(schema)
    if (!resolved) {
      return false
    }
    return isSimpleSchema(resolved, seen)
  }
  if (typeof schema.type === 'string' && SIMPLE_QUERY_TYPES.has(schema.type)) {
    return true
  }
  if (Array.isArray(schema.enum) && schema.enum.length > 0) {
    return true
  }
  if (schema.const !== undefined) {
    return true
  }
  return false
}

function resetSchemaRegistry() {
  schemaRefs = new WeakMap<object, string>()
  nameToType.clear()
  for (const key of Object.keys(globalSchemas)) {
    delete globalSchemas[key]
  }
}

function ensureSchema(type: unknown): SchemaEnsureResult | undefined {
  if (type === undefined || type === null) {
    return undefined
  }

  const resolution = createSchemaResolution(type)
  if (!resolution) {
    return undefined
  }

  if (resolution.kind === 'inline') {
    return {
      schema: cloneSchema(resolution.schema),
      isComponent: false,
    }
  }

  const schemaClone = cloneSchema(resolution.schema)
  const componentName = ensureComponentName(
    resolution.typeRef,
    schemaClone,
    resolution.suggestedName,
  )

  return {
    schema: cloneSchema(globalSchemas[componentName]),
    ref: `#/components/schemas/${componentName}`,
    componentName,
    isComponent: true,
  }
}

function createSchemaResolution(type: unknown): SchemaResolution | undefined {
  if (type === undefined || type === null) {
    return undefined
  }

  if (isSwaggerSchema(type)) {
    return { kind: 'inline', schema: cloneSchema(type) }
  }

  if (Array.isArray(type)) {
    if (type.length === 1) {
      const itemEnsured = ensureSchema(type[0])
      const itemsSchema = toSchemaOrRef(itemEnsured)
      return {
        kind: 'inline',
        schema: {
          type: 'array',
          items: itemsSchema,
        },
      }
    }
    return { kind: 'inline', schema: { type: 'array' } }
  }

  if (isLiteralValue(type)) {
    return { kind: 'inline', schema: schemaFromLiteral(type) }
  }

  if (isPrimitiveConstructor(type)) {
    return { kind: 'inline', schema: schemaFromPrimitiveCtor(type as Function) }
  }

  if (typeof type === 'function') {
    const resolution = schemaFromFunction(type)
    if (resolution) {
      return resolution
    }
  }

  if (typeof type === 'object') {
    const resolution = schemaFromInstance(type as object)
    if (resolution) {
      return resolution
    }
  }

  return undefined
}

function schemaFromFunction(fn: Function): SchemaResolution | undefined {
  const ctor = fn as Function & { toJsonSchema?: () => unknown }
  if (typeof ctor.toJsonSchema === 'function') {
    const schema = asSwaggerSchema(ctor.toJsonSchema())
    return {
      kind: 'component',
      schema,
      typeRef: ctor,
      suggestedName: ctor.name,
    }
  }

  if (fn.length === 0) {
    try {
      const result = (fn as () => unknown)()
      if (result && result !== fn) {
        return createSchemaResolution(result)
      }
    } catch {
      // ignore runtime errors from invoking factories
    }
  }

  return undefined
}

function schemaFromInstance(obj: object): SchemaResolution | undefined {
  if (isSwaggerSchema(obj)) {
    return { kind: 'inline', schema: cloneSchema(obj as TSwaggerSchema) }
  }

  const ctor = (obj as { constructor?: { toJsonSchema?: () => unknown; name?: string } })
    .constructor
  if (ctor && typeof ctor.toJsonSchema === 'function') {
    const schema = asSwaggerSchema(ctor.toJsonSchema())
    return {
      kind: 'component',
      schema,
      typeRef: ctor,
      suggestedName: ctor.name,
    }
  }

  if (typeof (obj as { toJsonSchema?: () => unknown }).toJsonSchema === 'function') {
    const schema = asSwaggerSchema((obj as { toJsonSchema: () => unknown }).toJsonSchema())
    return {
      kind: 'component',
      schema,
      typeRef: obj,
      suggestedName: getTypeName(obj),
    }
  }

  return undefined
}

function asSwaggerSchema(schema: unknown): TSwaggerSchema {
  if (!schema || typeof schema !== 'object') {
    return {}
  }
  return cloneSchema(schema as TSwaggerSchema)
}

function ensureComponentName(typeRef: object, schema: TSwaggerSchema, suggestedName?: string) {
  const existing = schemaRefs.get(typeRef)
  if (existing) {
    if (!globalSchemas[existing]) {
      globalSchemas[existing] = cloneSchema(schema)
    }
    return existing
  }

  const baseName = sanitizeComponentName(
    suggestedName || schema.title || getTypeName(typeRef) || 'Schema',
  )
  let candidate = baseName || 'Schema'
  let counter = 1
  while (nameToType.has(candidate)) {
    candidate = `${baseName}_${counter++}`
  }

  nameToType.set(candidate, typeRef)
  schemaRefs.set(typeRef, candidate)
  applySwaggerMetadata(typeRef, schema)
  globalSchemas[candidate] = cloneSchema(schema)

  return candidate
}

function applySwaggerMetadata(typeRef: object, schema: TSwaggerSchema) {
  try {
    const mate = getSwaggerMate()
    const meta = mate.read(typeRef as never) as
      | (TSwaggerMate & { label?: string; id?: string; description?: string })
      | undefined
    if (!meta) {
      return
    }
    if (meta.swaggerExample !== undefined && schema.example === undefined) {
      schema.example = meta.swaggerExample
    }
    const title = meta.label || meta.id
    if (title && !schema.title) {
      schema.title = title
    }
    if (meta.swaggerDescription && !schema.description) {
      schema.description = meta.swaggerDescription
    } else if (meta.description && !schema.description) {
      schema.description = meta.description
    }
  } catch {
    // ignore metadata errors
  }
}

function sanitizeComponentName(name: string) {
  const sanitized = name.replaceAll(/[^A-Za-z0-9_.-]/g, '_')
  return sanitized || 'Schema'
}

function getTypeName(typeRef: object) {
  if (typeof typeRef === 'function' && typeRef.name) {
    return typeRef.name
  }
  const ctor = (typeRef as { constructor?: { name?: string } }).constructor
  if (ctor && ctor !== Object && ctor.name) {
    return ctor.name
  }
  return undefined
}

function isSwaggerSchema(candidate: unknown): candidate is TSwaggerSchema {
  if (!candidate || typeof candidate !== 'object') {
    return false
  }
  const obj = candidate as Record<string, unknown>
  return (
    '$ref' in obj ||
    'type' in obj ||
    'properties' in obj ||
    'items' in obj ||
    'allOf' in obj ||
    'anyOf' in obj ||
    'oneOf' in obj
  )
}

function isLiteralValue(value: unknown): value is string | number | boolean | bigint {
  const type = typeof value
  return type === 'string' || type === 'number' || type === 'boolean' || type === 'bigint'
}

function schemaFromLiteral(value: string | number | boolean | bigint): TSwaggerSchema {
  if (typeof value === 'string') {
    if (['string', 'number', 'boolean', 'integer', 'object', 'array'].includes(value)) {
      return { type: value }
    }
    return { const: value, type: 'string' }
  }
  if (typeof value === 'number') {
    return {
      const: value,
      type: Number.isInteger(value) ? 'integer' : 'number',
    }
  }
  if (typeof value === 'boolean') {
    return { const: value, type: 'boolean' }
  }
  return { const: value.toString(), type: 'integer' }
}

function isPrimitiveConstructor(value: unknown): value is Function {
  if (typeof value !== 'function') {
    return false
  }
  return (
    value === String ||
    value === Number ||
    value === Boolean ||
    value === BigInt ||
    value === Date ||
    value === Array ||
    value === Object ||
    value === Symbol
  )
}

function schemaFromPrimitiveCtor(fn: Function): TSwaggerSchema {
  switch (fn) {
    case String: {
      return { type: 'string' }
    }
    case Number: {
      return { type: 'number' }
    }
    case Boolean: {
      return { type: 'boolean' }
    }
    case BigInt: {
      return { type: 'integer' }
    }
    case Date: {
      return { type: 'string', format: 'date-time' }
    }
    case Array: {
      return { type: 'array' }
    }
    case Object: {
      return { type: 'object' }
    }
    case Symbol: {
      return { type: 'string' }
    }
    default: {
      return { type: 'object' }
    }
  }
}

function resolveSchemaFromRef(schema: TSwaggerSchema): TSwaggerSchema | undefined {
  if (!schema.$ref) {
    return schema
  }
  const refName = schema.$ref.replace('#/components/schemas/', '')
  return globalSchemas[refName]
}

function cloneSchema(schema: TSwaggerSchema): TSwaggerSchema {
  return JSON.parse(JSON.stringify(schema)) as TSwaggerSchema
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
