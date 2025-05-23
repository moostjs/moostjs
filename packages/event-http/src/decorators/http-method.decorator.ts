import type { TMoostMetadata } from 'moost'
import { getMoostMate } from 'moost'

import type { TEmpty } from '../common-types'

export function HttpMethod(
  method: '*' | 'GET' | 'PUT' | 'POST' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS',
  path?: string
): MethodDecorator {
  return getMoostMate<TEmpty, TMoostMetadata<{ method: typeof method }>>().decorate(
    'handlers',
    { method, path, type: 'HTTP' },
    true
  )
}

export const All = (path?: string) => HttpMethod('*', path)

export const Get = (path?: string) => HttpMethod('GET', path)

export const Post = (path?: string) => HttpMethod('POST', path)

export const Put = (path?: string) => HttpMethod('PUT', path)

export const Delete = (path?: string) => HttpMethod('DELETE', path)

export const Patch = (path?: string) => HttpMethod('PATCH', path)
