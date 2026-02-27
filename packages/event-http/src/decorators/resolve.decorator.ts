import type { TCookieAttributes as TCookieAttributesRequired } from '@wooksjs/event-http'
import {
  useAuthorization,
  useCookies,
  useHeaders,
  useRequest,
  useResponse,
  useUrlParams,
} from '@wooksjs/event-http'
import { useBody } from '@wooksjs/http-body'
import type { TObject } from 'moost'
import { getMoostMate, Resolve } from 'moost'

function createRef<T>(getter: () => T, setter: (v: T) => void): { value: T } {
  return new Proxy({} as { value: T }, {
    get: (_target, prop) => (prop === 'value' ? getter() : undefined),
    set: (_target, prop, v) => {
      if (prop === 'value') {
        setter(v)
      }
      return true
    },
  })
}

/**
 * Ref to the Response Status
 * @decorator
 * @paramType TStatusRef
 */
export const StatusRef = () =>
  Resolve((metas, level) => {
    const response = useResponse()
    if (level === 'PARAM') {
      return createRef(
        () => response.status,
        (v) => {
          response.status = v
        },
      )
    }
    if (level === 'PROP' && metas.instance && metas.key) {
      const initialValue = metas.instance[metas.key as keyof typeof metas.instance]
      Object.defineProperty(metas.instance, metas.key, {
        get: () => response.status,
        set: (v: number) => {
          response.status = v
        },
        configurable: true,
      })
      return typeof initialValue === 'number' ? initialValue : 200
    }
  }, 'statusCode')

/**
 * Ref to the Response Header
 * @decorator
 * @param name - header name
 * @paramType THeaderRef
 */
export const HeaderRef = (name: string) =>
  Resolve((metas, level) => {
    const response = useResponse()
    if (level === 'PARAM') {
      return createRef(
        () => response.getHeader(name),
        (v) => response.setHeader(name, v as string | number | string[]),
      )
    }
    if (level === 'PROP' && metas.instance && metas.key) {
      const initialValue = metas.instance[metas.key as keyof typeof metas.instance]
      Object.defineProperty(metas.instance, metas.key, {
        get: () => response.getHeader(name),
        set: (v: string | number | string[]) => response.setHeader(name, v),
        configurable: true,
      })
      return typeof initialValue === 'string' ? initialValue : ''
    }
  }, name)

/**
 * Ref to the Response Cookie
 * @decorator
 * @param name - cookie name
 * @paramType TCookieRef
 */
export const CookieRef = (name: string) =>
  Resolve((metas, level) => {
    const response = useResponse()
    if (level === 'PARAM') {
      return createRef(
        () => response.getCookie(name)?.value,
        (v) => response.setCookie(name, v ?? ''),
      )
    }
    if (level === 'PROP' && metas.instance && metas.key) {
      const initialValue = metas.instance[metas.key as keyof typeof metas.instance]
      Object.defineProperty(metas.instance, metas.key, {
        get: () => response.getCookie(name)?.value,
        set: (v: string) => response.setCookie(name, v ?? ''),
        configurable: true,
      })
      return typeof initialValue === 'string' ? initialValue : ''
    }
  }, name)

/**
 * Ref to the Response Cookie Attributes
 * @decorator
 * @param name - cookie name
 * @paramType TCookieAttributes
 */
export const CookieAttrsRef = (name: string) =>
  Resolve((metas, level) => {
    const response = useResponse()
    const getAttrs = (): TCookieAttributes => response.getCookie(name)?.attrs ?? {}
    const setAttrs = (v: TCookieAttributes) => {
      const existing = response.getCookie(name)
      response.setCookie(name, existing?.value ?? '', v)
    }
    if (level === 'PARAM') {
      return createRef(getAttrs, setAttrs)
    }
    if (level === 'PROP' && metas.instance && metas.key) {
      const initialValue = metas.instance[metas.key as keyof typeof metas.instance]
      Object.defineProperty(metas.instance, metas.key, {
        get: getAttrs,
        set: setAttrs,
        configurable: true,
      })
      return typeof initialValue === 'object' ? initialValue : {}
    }
  }, name)

/**
 * Parse Authorisation Header
 * @decorator
 * @param name - define what to take from the Auth header
 * @paramType string
 */
export function Authorization(name: 'username' | 'password' | 'bearer' | 'raw' | 'type') {
  return Resolve(() => {
    const auth = useAuthorization()
    switch (name) {
      case 'username': {
        return auth.is('basic') ? auth.basicCredentials()?.username : undefined
      }
      case 'password': {
        return auth.is('basic') ? auth.basicCredentials()?.password : undefined
      }
      case 'bearer': {
        return auth.is('bearer') ? auth.authorization : undefined
      }
      case 'raw': {
        return auth.credentials()
      }
      case 'type': {
        return auth.type()
      }
      default: {
        return undefined
      }
    }
  }, 'authorization')
}

/**
 * Get Request Header Value
 * @decorator
 * @param name - header name
 * @paramType string
 */
export function Header(name: string) {
  return Resolve(() => {
    const headers = useHeaders()
    return headers[name]
  }, `header: ${name}`)
}

/**
 * Get Request Cookie Value
 * @decorator
 * @param name - cookie name
 * @paramType string
 */
export function Cookie(name: string) {
  return Resolve(() => useCookies().getCookie(name), `cookie: ${name}`)
}

/**
 * Get Query Item value or the whole parsed Query as an object
 * @decorator
 * @param name - query item name (optional)
 * @paramType string | object
 */
export function Query(name?: string): ParameterDecorator {
  const isItem = !!name
  const _name = isItem ? name : 'Query'
  return getMoostMate().apply(
    getMoostMate().decorate('paramSource', isItem ? 'QUERY_ITEM' : 'QUERY'),
    getMoostMate().decorate('paramName', _name),
    Resolve(() => {
      const { toJson, params } = useUrlParams()
      if (isItem) {
        const p = params()
        const value = p.get(name)
        return value === null ? undefined : value
      }
      const json = toJson() as TObject
      return Object.keys(json).length > 0 ? json : undefined
    }, _name),
  )
}

/**
 * Get Requested URL
 * @decorator
 * @paramType string
 */
export function Url() {
  return Resolve(() => useRequest().url || '', 'url')
}

/**
 * Get Requested HTTP Method
 * @decorator
 * @paramType string
 */
export function Method() {
  return Resolve(() => useRequest().method, 'http_method')
}

/**
 * Get Raw Request Instance
 * @decorator
 * @paramType IncomingMessage
 */
export function Req() {
  return Resolve(() => useRequest().raw, 'request')
}

/**
 * Get Raw Response Instance
 * @decorator
 * @param opts (optional) { passthrough: boolean }
 * @paramType ServerResponse
 */
export function Res(opts?: { passthrough: boolean }) {
  return Resolve(() => useResponse().getRawRes(opts?.passthrough), 'response')
}

/**
 * Get Request Unique Identificator (UUID)
 * @decorator
 * @paramType string
 */
export function ReqId() {
  return Resolve(() => useRequest().reqId(), 'reqId')
}

/**
 * Get Request IP Address
 * @decorator
 * @paramType string
 */
export function Ip(opts?: { trustProxy: boolean }) {
  return Resolve(() => useRequest().getIp(opts), 'ip')
}

/**
 * Get Request IP Address list
 * @decorator
 * @paramType string[]
 */
export function IpList() {
  return Resolve(() => useRequest().getIpList(), 'ipList')
}

/**
 * Get Parsed Request Body
 * @decorator
 * @paramType object | string | unknown
 */
export function Body() {
  return getMoostMate().apply(
    getMoostMate().decorate('paramSource', 'BODY'),
    Resolve(() => useBody().parseBody(), 'body'),
  )
}

/**
 * Get Raw Request Body Buffer
 * @decorator
 * @paramType Promise<Buffer>
 */
export function RawBody() {
  return Resolve(() => useBody().rawBody(), 'body')
}

/** Reactive ref for reading/writing the response status code. */
export interface TStatusRef {
  value: number
}

/** Reactive ref for reading/writing a response header value. */
export interface THeaderRef {
  value: string | string[] | undefined
}

/** Partial cookie attributes (all optional). */
export type TCookieAttributes = Partial<TCookieAttributesRequired>

/** Reactive ref for reading/writing a response cookie. */
export interface TCookieRef {
  value: string
  attrs?: TCookieAttributes
}
