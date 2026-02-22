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
  swaggerSecurity?: TSwaggerSecurityRequirement[]
  swaggerPublic?: boolean
}

export type TSwaggerConfigType = TFunction | { toJsonSchema?: () => unknown } | TSwaggerSchema

interface TSwaggerResponseConfig {
  contentType?: string
  description?: string
  response: TSwaggerConfigType
}

export type TSwaggerResponseOpts = TSwaggerConfigType | TSwaggerResponseConfig

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
