import { getMoostMate } from '../metadata/moost-metadata'

export function HttpMethod(method: '*' | 'GET' | 'PUT' | 'POST' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS', path?: string): MethodDecorator {
    return getMoostMate().decorate('httpHandler', { method, path }, true)
}

export const All = (path?: string) => HttpMethod('*', path)

export const Get = (path?: string) => HttpMethod('GET', path)

export const Post = (path?: string) => HttpMethod('POST', path)

export const Put = (path?: string) => HttpMethod('PUT', path)

export const Delete = (path?: string) => HttpMethod('DELETE', path)

export const Patch = (path?: string) => HttpMethod('PATCH', path)
