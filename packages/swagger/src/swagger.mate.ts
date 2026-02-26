import { getMoostMate } from 'moost'
import type { TMoostMetadata, Mate, TMateParamMeta } from 'moost'

import type { TFunction } from './common-types'
import type { TSwaggerSchema } from './mapping'

/** Returns the shared `Mate` instance extended with Swagger/OpenAPI metadata fields. */
export function getSwaggerMate(): Mate<
  TMoostMetadata &
    TSwaggerMate & {
      params: TMateParamMeta[]
    },
  TMoostMetadata &
    TSwaggerMate & {
      params: TMateParamMeta[]
    }
> {
  return getMoostMate<TSwaggerMate, TSwaggerMate>()
}

/** Swagger/OpenAPI metadata fields attached to classes and methods by swagger decorators. */
export interface TSwaggerMate {
  swaggerTags: string[]
  swaggerExclude: boolean
  swaggerDescription: string
  swaggerResponses: Record<
    number,
    {
      description?: string
      headers?: Record<string, TSwaggerResponseHeader>
      content: Record<string, { response: TSwaggerConfigType; example?: unknown }>
    }
  >
  swaggerRequestBody: Record<string, TSwaggerConfigType>
  swaggerExample?: unknown
  swaggerParams: {
    name: string
    in: 'query' | 'header' | 'path' | 'formData' | 'body'
    description?: string
    required?: boolean
    type?: TSwaggerConfigType
  }[]
  swaggerLinks?: TSwaggerLinkConfig[]
  swaggerCallbacks?: TSwaggerCallbackConfig[]
  swaggerSecurity?: TSwaggerSecurityRequirement[]
  swaggerPublic?: boolean
  swaggerDeprecated?: boolean
  swaggerOperationId?: string
  swaggerExternalDocs?: TSwaggerExternalDocs
}

/** A type reference for OpenAPI schema generation — class, schema object, or array wrapper. */
export type TSwaggerConfigType =
  | TFunction
  | { toJsonSchema?: () => unknown }
  | TSwaggerSchema
  | [TSwaggerConfigType]

/** Describes a single response header in the OpenAPI spec. */
export interface TSwaggerResponseHeader {
  description?: string
  required?: boolean
  type?: TSwaggerConfigType
  example?: unknown
}

interface TSwaggerResponseConfig {
  contentType?: string
  description?: string
  response: TSwaggerConfigType
  example?: unknown
  headers?: Record<string, TSwaggerResponseHeader>
}

/** Options accepted by `@SwaggerResponse` — either a bare schema type or a full config. */
export type TSwaggerResponseOpts = TSwaggerConfigType | TSwaggerResponseConfig

/** External documentation link for an OpenAPI operation. */
export interface TSwaggerExternalDocs {
  url: string
  description?: string
}

// --- Link types (OpenAPI 3.0 links) ---

/** Configuration for an OpenAPI 3.0 link object on a response. */
export interface TSwaggerLinkConfig {
  /** Status code this link applies to. 0 = use default for the HTTP method. */
  statusCode: number
  /** The link name (key in the response `links` object). */
  name: string
  /** Target operation by explicit operationId string. */
  operationId?: string
  /** Target operation by JSON pointer (operationRef). */
  operationRef?: string
  /** Target operation by controller class + method name, resolved at mapping time. */
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

// --- Callback types (OpenAPI 3.0 callbacks) ---

/** Configuration for an OpenAPI 3.0 callback (webhook) on an operation. */
export interface TSwaggerCallbackConfig {
  /** Callback name (key in the operation's `callbacks` object). */
  name: string
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

// --- Security scheme types (OpenAPI 3.0) ---

/** OpenAPI security requirement — maps scheme name to required scopes. */
export type TSwaggerSecurityRequirement = Record<string, string[]>

/** OpenAPI HTTP security scheme (e.g. bearer, basic). */
export interface TSwaggerSecuritySchemeHttp {
  type: 'http'
  scheme: string
  bearerFormat?: string
  description?: string
}

/** OpenAPI API key security scheme. */
export interface TSwaggerSecuritySchemeApiKey {
  type: 'apiKey'
  in: 'header' | 'query' | 'cookie'
  name: string
  description?: string
}

/** Configuration for a single OAuth2 flow. */
export interface TSwaggerSecuritySchemeOAuth2Flow {
  authorizationUrl?: string
  tokenUrl?: string
  refreshUrl?: string
  scopes: Record<string, string>
}

/** OpenAPI OAuth2 security scheme with one or more flows. */
export interface TSwaggerSecuritySchemeOAuth2 {
  type: 'oauth2'
  flows: {
    implicit?: TSwaggerSecuritySchemeOAuth2Flow
    password?: TSwaggerSecuritySchemeOAuth2Flow
    clientCredentials?: TSwaggerSecuritySchemeOAuth2Flow
    authorizationCode?: TSwaggerSecuritySchemeOAuth2Flow
  }
  description?: string
}

/** OpenAPI OpenID Connect security scheme. */
export interface TSwaggerSecuritySchemeOpenIdConnect {
  type: 'openIdConnect'
  openIdConnectUrl: string
  description?: string
}

/** Union of all supported OpenAPI security scheme types. */
export type TSwaggerSecurityScheme =
  | TSwaggerSecuritySchemeHttp
  | TSwaggerSecuritySchemeApiKey
  | TSwaggerSecuritySchemeOAuth2
  | TSwaggerSecuritySchemeOpenIdConnect
