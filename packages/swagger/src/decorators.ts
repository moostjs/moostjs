import type { TFunction } from './common-types'
import type {
  TSwaggerCallbackConfig,
  TSwaggerConfigType,
  TSwaggerLinkConfig,
  TSwaggerMate,
  TSwaggerResponseHeader,
  TSwaggerResponseOpts,
  TSwaggerSecurityRequirement,
} from './swagger.mate'
import { getSwaggerMate } from './swagger.mate'

/** Adds an OpenAPI tag to a controller or handler for grouping in the Swagger UI. */
export const SwaggerTag = (tag: string) => getSwaggerMate().decorate('swaggerTags', tag, true)

/** Excludes a controller or handler from the generated OpenAPI spec. */
export const SwaggerExclude = () => getSwaggerMate().decorate('swaggerExclude', true)

/** Sets the OpenAPI description for a handler. */
export const SwaggerDescription = (descr: string) =>
  getSwaggerMate().decorate('swaggerDescription', descr)

/**
 * Defines a response schema in the OpenAPI spec.
 * Can be called with just options (uses status 200) or with an explicit status code.
 *
 * @example
 * ```ts
 * @SwaggerResponse({ response: MyDto })
 * @SwaggerResponse(404, { response: ErrorDto })
 * ```
 */
export function SwaggerResponse(opts: TSwaggerResponseOpts, example?: unknown): MethodDecorator
export function SwaggerResponse(
  code: number,
  opts: TSwaggerResponseOpts,
  example?: unknown,
): MethodDecorator
export function SwaggerResponse(
  code: number | TSwaggerResponseOpts,
  opts?: TSwaggerResponseOpts | unknown,
  example?: unknown,
): MethodDecorator {
  return getSwaggerMate().decorate((meta) => {
    let ex: unknown
    if (example) {
      ex = example
    }
    if (typeof code !== 'number' && opts) {
      ex = opts
    }
    if (ex === undefined) {
      ex = (typeof code === 'number' ? opts : code) as { example?: unknown } | undefined
      ex = (ex as { example?: unknown } | undefined)?.example
    }
    meta.swaggerResponses = meta.swaggerResponses || {}
    const keyCode = typeof code === 'number' ? code : 0
    const opt = typeof code === 'number' ? opts : code
    const contentType =
      typeof (opt as { contentType: string }).contentType === 'string'
        ? (opt as { contentType: string }).contentType
        : '*/*'
    const description =
      typeof (opt as { description: string }).description === 'string'
        ? (opt as { description: string }).description
        : undefined
    const headers = (opt as { headers?: Record<string, TSwaggerResponseHeader> }).headers
    const response = (
      ['object', 'function'].includes(typeof (opt as { response: unknown }).response)
        ? (opt as { response: unknown }).response
        : opt
    ) as TSwaggerConfigType
    meta.swaggerResponses[keyCode] = meta.swaggerResponses[keyCode] || { content: {} }
    meta.swaggerResponses[keyCode].content[contentType] = { response, example: ex }
    if (description) {
      meta.swaggerResponses[keyCode].description = description
    }
    if (headers) {
      meta.swaggerResponses[keyCode].headers = {
        ...meta.swaggerResponses[keyCode].headers,
        ...headers,
      }
    }
    return meta
  })
}

/**
 * Defines the request body schema in the OpenAPI spec.
 *
 * @param opt - Schema definition. Use `{ response: MyDto }` for a typed schema,
 *   or `{ response: MyDto, contentType: 'multipart/form-data' }` for a specific content type.
 */
export function SwaggerRequestBody(opt: TSwaggerResponseOpts) {
  return getSwaggerMate().decorate((meta) => {
    meta.swaggerRequestBody = meta.swaggerRequestBody || {}
    const contentType =
      typeof (opt as { contentType: string }).contentType === 'string'
        ? (opt as { contentType: string }).contentType
        : 'application/json'
    const response = (
      typeof (opt as { contentType: string }).contentType === 'string'
        ? (opt as { response: string }).response
        : opt
    ) as TSwaggerConfigType
    meta.swaggerRequestBody[contentType] = response
    return meta
  })
}

/** Defines a parameter (query, path, header, cookie) in the OpenAPI spec. */
export function SwaggerParam(opts: TSwaggerMate['swaggerParams'][number]) {
  return getSwaggerMate().decorate('swaggerParams', opts, true)
}

/** Attaches an example value to a handler's OpenAPI documentation. */
export function SwaggerExample(example: unknown) {
  return getSwaggerMate().decorate('swaggerExample', example)
}

/** Marks a handler or controller as public, opting out of inherited security requirements. */
export const SwaggerPublic = () => getSwaggerMate().decorate('swaggerPublic', true)

/** Marks a handler or controller as deprecated in the OpenAPI spec. */
export const SwaggerDeprecated = () => getSwaggerMate().decorate('swaggerDeprecated', true)

/** Overrides the auto-generated operationId for an endpoint. */
export const SwaggerOperationId = (id: string) =>
  getSwaggerMate().decorate('swaggerOperationId', id)

/** Links an operation to external documentation. */
export const SwaggerExternalDocs = (url: string, description?: string) =>
  getSwaggerMate().decorate('swaggerExternalDocs', { url, ...(description ? { description } : {}) })

/**
 * Attaches a security requirement to a handler or controller (OR semantics).
 * Multiple calls add alternative requirements — any one suffices.
 *
 * @param schemeName - The name of the security scheme (must match a key in securitySchemes)
 * @param scopes - OAuth2/OIDC scopes required (default: [])
 */
export function SwaggerSecurity(schemeName: string, scopes: string[] = []) {
  return getSwaggerMate().decorate('swaggerSecurity', { [schemeName]: scopes }, true)
}

/**
 * Attaches a combined security requirement (AND semantics).
 * All schemes in the requirement must be satisfied simultaneously.
 */
export function SwaggerSecurityAll(requirement: TSwaggerSecurityRequirement) {
  return getSwaggerMate().decorate('swaggerSecurity', requirement, true)
}

// --- Link types & decorator ---

export interface TSwaggerLinkOptions {
  /** Target by explicit operationId string. */
  operationId?: string
  /** Target by JSON pointer (operationRef). */
  operationRef?: string
  /** Target by controller class + method name, resolved at mapping time. */
  handler?: [TFunction, string]
  /** Map of parameter name to runtime expression (e.g. `'$response.body#/id'`). */
  parameters?: Record<string, string>
  /** Runtime expression for the request body. */
  requestBody?: string
  /** Human-readable description. */
  description?: string
  /** Alternative server for the link target. */
  server?: { url: string; description?: string }
}

/**
 * Adds an OpenAPI link to a response, describing how response values
 * can be used as input to another operation.
 *
 * @example
 * ```ts
 * // Reference by operationId
 * @SwaggerLink('GetUser', {
 *   operationId: 'getUser',
 *   parameters: { userId: '$response.body#/id' },
 * })
 *
 * // Reference by controller class + method (resolved at mapping time)
 * @SwaggerLink('GetUser', {
 *   handler: [UserController, 'getUser'],
 *   parameters: { userId: '$response.body#/id' },
 * })
 *
 * // On a specific status code
 * @SwaggerLink(201, 'GetUser', {
 *   operationId: 'getUser',
 *   parameters: { userId: '$response.body#/id' },
 * })
 * ```
 */
export function SwaggerLink(name: string, options: TSwaggerLinkOptions): MethodDecorator
export function SwaggerLink(
  statusCode: number,
  name: string,
  options: TSwaggerLinkOptions,
): MethodDecorator
export function SwaggerLink(
  codeOrName: number | string,
  nameOrOptions: string | TSwaggerLinkOptions,
  maybeOptions?: TSwaggerLinkOptions,
): MethodDecorator {
  const statusCode = typeof codeOrName === 'number' ? codeOrName : 0
  const name = typeof codeOrName === 'string' ? codeOrName : (nameOrOptions as string)
  const options =
    typeof codeOrName === 'string' ? (nameOrOptions as TSwaggerLinkOptions) : maybeOptions!

  const config: TSwaggerLinkConfig = {
    statusCode,
    name,
    ...('operationId' in options && options.operationId
      ? { operationId: options.operationId }
      : {}),
    ...('operationRef' in options && options.operationRef
      ? { operationRef: options.operationRef }
      : {}),
    ...('handler' in options && options.handler ? { handler: options.handler } : {}),
    ...(options.parameters ? { parameters: options.parameters } : {}),
    ...(options.requestBody ? { requestBody: options.requestBody } : {}),
    ...(options.description ? { description: options.description } : {}),
    ...(options.server ? { server: options.server } : {}),
  }

  return getSwaggerMate().decorate('swaggerLinks', config, true)
}

// --- Callback types & decorator ---

export interface TSwaggerCallbackOptions {
  /** Runtime expression for the callback URL (e.g. `'{$request.body#/callbackUrl}'`). */
  expression: string
  /** HTTP method your server uses to call the webhook (default: `'post'`). */
  method?: string
  /** Schema for the request body your server sends. Resolved via the schema pipeline. */
  requestBody?: TSwaggerConfigType
  /** Content type for the request body (default: `'application/json'`). */
  contentType?: string
  /** Description for the callback operation. */
  description?: string
  /** Expected response status code from the webhook receiver (default: `200`). */
  responseStatus?: number
  /** Description for the expected response (default: `'OK'`). */
  responseDescription?: string
}

/**
 * Documents an OpenAPI callback (webhook) on an operation.
 * Describes a request your server sends to a client-provided URL.
 *
 * @example
 * ```ts
 * @SwaggerCallback('onEvent', {
 *   expression: '{$request.body#/callbackUrl}',
 *   requestBody: EventPayloadDto,
 *   description: 'Event notification sent to subscriber',
 * })
 * @Post('subscribe')
 * subscribe() { ... }
 * ```
 */
export function SwaggerCallback(name: string, options: TSwaggerCallbackOptions): MethodDecorator {
  const config: TSwaggerCallbackConfig = {
    name,
    expression: options.expression,
    ...(options.method ? { method: options.method } : {}),
    ...(options.requestBody ? { requestBody: options.requestBody } : {}),
    ...(options.contentType ? { contentType: options.contentType } : {}),
    ...(options.description ? { description: options.description } : {}),
    ...(options.responseStatus ? { responseStatus: options.responseStatus } : {}),
    ...(options.responseDescription ? { responseDescription: options.responseDescription } : {}),
  }

  return getSwaggerMate().decorate('swaggerCallbacks', config, true)
}
