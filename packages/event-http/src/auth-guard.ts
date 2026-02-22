import {
  HttpError,
  useAuthorization,
  useCookies,
  useHeaders,
  useSearchParams,
} from '@wooksjs/event-http'
import type { TClassFunction, TInterceptorFn, TClassConstructor } from 'moost'
import { getMoostMate, Injectable, TInterceptorPriority } from 'moost'

// --- Transport declaration types ---

export interface TAuthTransportBearer {
  format?: string
  description?: string
}

export interface TAuthTransportBasic {
  description?: string
}

export interface TAuthTransportApiKey {
  name: string
  in: 'header' | 'query' | 'cookie'
  description?: string
}

export interface TAuthTransportCookie {
  name: string
  description?: string
}

export interface TAuthTransportDeclaration {
  bearer?: TAuthTransportBearer
  basic?: TAuthTransportBasic
  apiKey?: TAuthTransportApiKey
  cookie?: TAuthTransportCookie
}

// --- Extracted transport values (type-narrowed) ---

export type TAuthTransportValues<T extends TAuthTransportDeclaration> = {
  [K in keyof T & keyof TAuthTransportDeclaration]: K extends 'basic'
    ? { username: string; password: string }
    : string
}

// --- Transport extraction ---

export function extractTransports<T extends TAuthTransportDeclaration>(
  declaration: T,
): TAuthTransportValues<T> {
  const result: Record<string, unknown> = {}

  if (declaration.bearer) {
    const auth = useAuthorization()
    if (auth.isBearer()) {
      result.bearer = auth.authRawCredentials()
    }
  }

  if (declaration.basic) {
    const auth = useAuthorization()
    if (auth.isBasic()) {
      result.basic = auth.basicCredentials()
    }
  }

  if (declaration.cookie) {
    const { getCookie } = useCookies()
    const val = getCookie(declaration.cookie.name)
    if (val) {
      result.cookie = val
    }
  }

  if (declaration.apiKey) {
    const { name, in: location } = declaration.apiKey
    if (location === 'header') {
      const headers = useHeaders()
      if (headers[name.toLowerCase()]) {
        result.apiKey = headers[name.toLowerCase()]
      }
    } else if (location === 'query') {
      const { urlSearchParams } = useSearchParams()
      const val = urlSearchParams().get(name)
      if (val) {
        result.apiKey = String(val)
      }
    } else if (location === 'cookie') {
      const { getCookie } = useCookies()
      const val = getCookie(name)
      if (val) {
        result.apiKey = val
      }
    }
  }

  if (Object.keys(result).length === 0) {
    throw new HttpError(401, 'No authentication credentials provided')
  }

  return result as TAuthTransportValues<T>
}

// --- Functional API ---

/** Auth guard function returned by defineAuthGuard — carries transport declarations. */
export interface TAuthGuardFn extends TInterceptorFn {
  __authTransports: TAuthTransportDeclaration
}

/** Auth guard class extending AuthGuard — carries transport declarations as static property. */
export type TAuthGuardClass = TClassConstructor<AuthGuard> & {
  transports: TAuthTransportDeclaration
  priority: TInterceptorPriority
}

/** Accepted handler for UseAuthGuard — either a functional or class-based auth guard. */
export type TAuthGuardHandler = TAuthGuardFn | TAuthGuardClass

export function defineAuthGuard<T extends TAuthTransportDeclaration>(
  transports: T,
  handler: (transports: TAuthTransportValues<T>) => unknown | Promise<unknown>,
): TAuthGuardFn {
  const guard: TInterceptorFn = () => {
    const extracted = extractTransports(transports)
    return handler(extracted)
  }
  guard.priority = TInterceptorPriority.GUARD
  const authGuard = guard as TAuthGuardFn
  authGuard.__authTransports = transports
  return authGuard
}

// --- Class-based API ---

@Injectable()
export abstract class AuthGuard<T extends TAuthTransportDeclaration = TAuthTransportDeclaration>
  implements TClassFunction<TInterceptorFn>
{
  static transports: TAuthTransportDeclaration
  static priority = TInterceptorPriority.GUARD

  abstract handle(transports: TAuthTransportValues<T>): unknown | Promise<unknown>

  handler: TInterceptorFn = () => {
    const ctor = this.constructor as typeof AuthGuard
    const extracted = extractTransports(ctor.transports)
    return this.handle(extracted as TAuthTransportValues<T>)
  }
}

// --- Authenticate decorator ---

/**
 * Registers an auth guard as an interceptor and stores its transport
 * declarations in metadata for swagger auto-discovery.
 *
 * Accepts either a functional guard from `defineAuthGuard()` or a
 * class-based guard extending `AuthGuard`.
 */
export function Authenticate(handler: TAuthGuardHandler): ClassDecorator & MethodDecorator {
  const mate = getMoostMate<{ authTransports: TAuthTransportDeclaration }>()
  const isClass = typeof handler === 'function' && 'transports' in handler
  const transports: TAuthTransportDeclaration = isClass
    ? (handler as TAuthGuardClass).transports
    : (handler as TAuthGuardFn).__authTransports
  const priority = isClass
    ? (handler as TAuthGuardClass).priority
    : (handler as TAuthGuardFn).priority || TInterceptorPriority.GUARD
  const name = handler.name || 'AuthGuard'
  return mate.apply(
    mate.decorate('interceptors', { handler, priority, name }, true),
    mate.decorate('authTransports', transports),
  )
}
