import { getMoostMate } from 'moost'
import type { TMoostMetadata, Mate, TMateParamMeta } from 'moost'

import type { TFunction } from './common-types'
import type { TSwaggerSchema } from './mapping'

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

export type TSwaggerConfigType = TFunction | { toJsonSchema?: () => unknown } | TSwaggerSchema

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

export type TSwaggerResponseOpts = TSwaggerConfigType | TSwaggerResponseConfig

export interface TSwaggerExternalDocs {
  url: string
  description?: string
}

// --- Link types (OpenAPI 3.0 links) ---

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

export type TSwaggerSecurityRequirement = Record<string, string[]>

export interface TSwaggerSecuritySchemeHttp {
  type: 'http'
  scheme: string
  bearerFormat?: string
  description?: string
}

export interface TSwaggerSecuritySchemeApiKey {
  type: 'apiKey'
  in: 'header' | 'query' | 'cookie'
  name: string
  description?: string
}

export interface TSwaggerSecuritySchemeOAuth2Flow {
  authorizationUrl?: string
  tokenUrl?: string
  refreshUrl?: string
  scopes: Record<string, string>
}

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

export interface TSwaggerSecuritySchemeOpenIdConnect {
  type: 'openIdConnect'
  openIdConnectUrl: string
  description?: string
}

export type TSwaggerSecurityScheme =
  | TSwaggerSecuritySchemeHttp
  | TSwaggerSecuritySchemeApiKey
  | TSwaggerSecuritySchemeOAuth2
  | TSwaggerSecuritySchemeOpenIdConnect
