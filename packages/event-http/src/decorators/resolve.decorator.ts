import { useCookies, useHeaders, useRequest, useResponse, useSearchParams,
    useAuthorization, useStatus, useSetHeader, useSetCookie } from '@wooksjs/event-http'
import { useBody } from '@wooksjs/http-body'
import { Resolve } from 'moost'

/**
 * Hook to the Response Status
 * @decorator
 * @paramType TStatusHook
 */
export const StatusHook = Resolve(() => useStatus(), 'status')

/**
 * Hook to the Response Header
 * @decorator
 * @param name - header name
 * @paramType THeaderHook
 */
export const HeaderHook = (name: string) => Resolve(() => useSetHeader(name), name)

/**
 * Hook to the Response Cookie
 * @decorator
 * @param name - header name
 * @paramType TCookieHook
 */
export const CookieHook = (name: string) => Resolve(() => useSetCookie(name), name)

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
            case 'username':
                return auth.isBasic() ? auth.basicCredentials()?.username : undefined
            case 'password':
                return auth.isBasic() ? auth.basicCredentials()?.password : undefined   
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
    return Resolve(() => {
        const { jsonSearchParams, urlSearchParams } = useSearchParams()
        if (name) {
            const p = urlSearchParams()
            const value = p.get(name)
            console.log(name + ' = ', value)
            return value === '' && p.has(name) || value
        }
        const json = jsonSearchParams() as object
        return Object.keys(json).length ? json : undefined
    }, name || 'Query')
}

/**
 * Get Requested URL
 * @decorator
 * @paramType string
 */
export function Url() {
    return Resolve(() => useRequest().url, 'url')
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
 * Get Raw Response Object
 * @decorator
 * @param options - passthrough options
 * @paramType string
 */
export function Res(options?: { passthrough: boolean }) {
    return Resolve(() => useResponse().rawResponse(options), 'response')
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
