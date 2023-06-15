import { THook, attachHook } from '@wooksjs/event-core'
import {
    useCookies,
    useHeaders,
    useRequest,
    useResponse,
    useSearchParams,
    useAuthorization,
    useStatus,
    useSetHeader,
    useSetCookie,
    TCookieAttributes as TCookieAttributesRequired,
} from '@wooksjs/event-http'
import { useBody } from '@wooksjs/http-body'
import { TObject } from 'common'
import { Resolve, getMoostMate } from 'moost'

/**
 * Hook to the Response Status
 * @decorator
 * @paramType TStatusHook
 */
export const StatusHook = () =>
    Resolve((metas, level) => {
        const hook = useStatus()
        if (level === 'PARAM') {
            return hook
        }
        if (level === 'PROP' && metas.instance && metas.key) {
            const initialValue =
                metas.instance[metas.key as keyof typeof metas.instance]
            attachHook(
                metas.instance,
                {
                    get: () => hook.value,
                    set: (v) => (hook.value = v),
                },
                metas.key
            )
            return typeof initialValue === 'number' ? initialValue : 200
        }
    }, 'statusCode')

/**
 * Hook to the Response Header
 * @decorator
 * @param name - header name
 * @paramType THeaderHook
 */
export const HeaderHook = (name: string) =>
    Resolve((metas, level) => {
        const hook = useSetHeader(name)
        if (level === 'PARAM') {
            return hook
        }
        if (level === 'PROP' && metas.instance && metas.key) {
            const initialValue =
                metas.instance[metas.key as keyof typeof metas.instance]
            attachHook(
                metas.instance,
                {
                    get: () => hook.value,
                    set: (v) => (hook.value = v),
                },
                metas.key
            )
            return typeof initialValue === 'string' ? initialValue : ''
        }
    }, name)

/**
 * Hook to the Response Cookie
 * @decorator
 * @param name - cookie name
 * @paramType TCookieHook
 */
export const CookieHook = (name: string) =>
    Resolve((metas, level) => {
        const hook = useSetCookie(name)
        if (level === 'PARAM') {
            return hook
        }
        if (level === 'PROP' && metas.instance && metas.key) {
            const initialValue =
                metas.instance[metas.key as keyof typeof metas.instance]
            attachHook(
                metas.instance,
                {
                    get: () => hook.value,
                    set: (v) => (hook.value = v),
                },
                metas.key
            )
            return typeof initialValue === 'string' ? initialValue : ''
        }
    }, name)

/**
 * Hook to the Response Cookie Attributes
 * @decorator
 * @param name - cookie name
 * @paramType TCookieAttributes
 */
export const CookieAttrsHook = (name: string) =>
    Resolve((metas, level) => {
        const hook = useSetCookie(name)
        if (level === 'PARAM') {
            return attachHook(
                {},
                {
                    get: () => hook.attrs,
                    set: (v) => (hook.attrs = v),
                }
            )
        }
        if (level === 'PROP' && metas.instance && metas.key) {
            const initialValue =
                metas.instance[metas.key as keyof typeof metas.instance]
            attachHook(
                metas.instance,
                {
                    get: () => hook.attrs,
                    set: (v) => (hook.attrs = v),
                },
                metas.key
            )
            return typeof initialValue === 'object' ? initialValue : {}
        }
    }, name)

/**
 * Parse Authorisation Header
 * @decorator
 * @param name - define what to take from the Auth header
 * @paramType string
 */
export function Authorization(
    name: 'username' | 'password' | 'bearer' | 'raw' | 'type'
) {
    return Resolve(() => {
        const auth = useAuthorization()
        switch (name) {
            case 'username':
                return auth.isBasic()
                    ? auth.basicCredentials()?.username
                    : undefined
            case 'password':
                return auth.isBasic()
                    ? auth.basicCredentials()?.password
                    : undefined
            case 'bearer':
                return auth.isBearer() ? auth.authorization : undefined
            case 'raw':
                return auth.authRawCredentials()
            case 'type':
                return auth.authType()
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
    }, 'header: ' + name)
}

/**
 * Get Request Cookie Value
 * @decorator
 * @param name - cookie name
 * @paramType string
 */
export function Cookie(name: string) {
    return Resolve(() => useCookies().getCookie(name), 'cookie: ' + name)
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
            const { jsonSearchParams, urlSearchParams } = useSearchParams()
            if (isItem) {
                const p = urlSearchParams()
                const value = p.get(name)
                return value === null ? undefined : value
            }
            const json = jsonSearchParams() as TObject
            return Object.keys(json).length ? json : undefined
        }, _name))
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
    return Resolve(() => useRequest().rawRequest, 'request')
}

/**
 * Get Raw Response Instance
 * @decorator
 * @param opts (optional) { passthrough: boolean }
 * @paramType ServerResponse
 */
export function Res(opts?: { passthrough: boolean }) {
    return Resolve(() => useResponse().rawResponse(opts), 'response')
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
    return Resolve(() => useBody().parseBody(), 'body')
}

/**
 * Get Raw Request Body Buffer
 * @decorator
 * @paramType Promise<Buffer>
 */
export function RawBody() {
    return Resolve(() => useBody().rawBody(), 'body')
}

export type TStatusHook = THook<number>
export type THeaderHook = THook
export type TCookieAttributes = Partial<TCookieAttributesRequired>
export type TCookieHook = THook & Partial<THook<TCookieAttributes, 'attrs'>>
