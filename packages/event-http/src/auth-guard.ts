import { current } from '@wooksjs/event-core'
import {
  HttpError,
  useAuthorization,
  useCookies,
  useHeaders,
  useUrlParams,
} from '@wooksjs/event-http'
import type { TClassConstructor, TInterceptorDef, TOvertakeFn } from 'moost'
import {
  Before,
  defineBeforeInterceptor,
  getMoostMate,
  Interceptor,
  Overtake,
  TInterceptorPriority,
} from 'moost'

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
  const ctx = current()
  const result: Record<string, unknown> = {}
  let found = false

  if (declaration.bearer) {
    const auth = useAuthorization(ctx)
    if (auth.is('bearer')) {
      result.bearer = auth.credentials()
      found = true
    }
  }

  if (declaration.basic) {
    const auth = useAuthorization(ctx)
    if (auth.is('basic')) {
      result.basic = auth.basicCredentials()
      found = true
    }
  }

  if (declaration.cookie) {
    const { getCookie } = useCookies(ctx)
    const val = getCookie(declaration.cookie.name)
    if (val) {
      result.cookie = val
      found = true
    }
  }

  if (declaration.apiKey) {
    const { name, in: location } = declaration.apiKey
    if (location === 'header') {
      const headers = useHeaders(ctx)
      if (headers[name.toLowerCase()]) {
        result.apiKey = headers[name.toLowerCase()]
        found = true
      }
    } else if (location === 'query') {
      const { params } = useUrlParams(ctx)
      const val = params().get(name)
      if (val) {
        result.apiKey = String(val)
        found = true
      }
    } else if (location === 'cookie') {
      const { getCookie } = useCookies(ctx)
      const val = getCookie(name)
      if (val) {
        result.apiKey = val
        found = true
      }
    }
  }

  if (!found) {
    throw new HttpError(401, 'No authentication credentials provided')
  }

  return result as TAuthTransportValues<T>
}

// --- Functional API ---

/** Auth guard def returned by defineAuthGuard — carries transport declarations. */
export interface TAuthGuardDef extends TInterceptorDef {
  __authTransports: TAuthTransportDeclaration
}

/** Auth guard class extending AuthGuard — carries transport declarations as static property. */
export type TAuthGuardClass = TClassConstructor<AuthGuard> & {
  transports: TAuthTransportDeclaration
  priority: TInterceptorPriority
}

/** Accepted handler for Authenticate — either a functional or class-based auth guard. */
export type TAuthGuardHandler = TAuthGuardDef | TAuthGuardClass

export function defineAuthGuard<T extends TAuthTransportDeclaration>(
  transports: T,
  handler: (transports: TAuthTransportValues<T>) => unknown | Promise<unknown>,
): TAuthGuardDef {
  const def = defineBeforeInterceptor((reply) => {
    const extracted = extractTransports(transports)
    const result = handler(extracted)
    if (
      result !== null &&
      result !== undefined &&
      typeof (result as PromiseLike<unknown>).then === 'function'
    ) {
      return (result as Promise<unknown>).then((r) => {
        if (r !== undefined) {
          reply(r)
        }
        return undefined
      })
    }
    if (result !== undefined) {
      reply(result)
    }
  }, TInterceptorPriority.GUARD)
  return Object.assign(def, { __authTransports: transports })
}

// --- Class-based API ---

@Interceptor(TInterceptorPriority.GUARD)
export abstract class AuthGuard<
  T extends TAuthTransportDeclaration = TAuthTransportDeclaration,
> {
  static transports: TAuthTransportDeclaration
  static priority = TInterceptorPriority.GUARD

  abstract handle(transports: TAuthTransportValues<T>): unknown | Promise<unknown>

  @Before()
  __intercept(@Overtake() reply: TOvertakeFn) {
    const ctor = this.constructor as typeof AuthGuard
    const extracted = extractTransports(ctor.transports)
    const result = this.handle(extracted as TAuthTransportValues<T>)
    if (
      result !== null &&
      result !== undefined &&
      typeof (result as PromiseLike<unknown>).then === 'function'
    ) {
      return (result as Promise<unknown>).then((r) => {
        if (r !== undefined) {
          reply(r)
        }
        return undefined
      })
    }
    if (result !== undefined) {
      reply(result)
    }
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
  const isClass = typeof handler === 'function'
  const transports: TAuthTransportDeclaration = isClass
    ? (handler as TAuthGuardClass).transports
    : (handler as TAuthGuardDef).__authTransports
  const priority = isClass
    ? (handler as TAuthGuardClass).priority
    : (handler as TAuthGuardDef).priority || TInterceptorPriority.GUARD
  const name = isClass ? handler.name : 'AuthGuard'
  return mate.apply(
    mate.decorate('interceptors', { handler, priority, name }, true),
    mate.decorate('authTransports', transports),
  )
}
