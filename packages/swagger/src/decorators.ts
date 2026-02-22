import type {
  TSwaggerConfigType,
  TSwaggerMate,
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
