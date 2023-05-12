import { Intercept, TInterceptorFn, TInterceptorPriority } from 'moost'
import { useSetCookies, useSetHeader, useStatus } from '@wooksjs/event-http'

const setHeaderInterceptor: (
    name: string,
    value: string,
    opts?: { force?: boolean; status?: number }
) => TInterceptorFn = (name, value, opts) => {
    const fn: TInterceptorFn = (before, after) => {
        const h = useSetHeader(name)
        const status = useStatus()
        after(() => {
            if (
                (!h.value || opts?.force) &&
                (!opts?.status || opts.status === status.value)
            ) {
                h.value = value
            }
        })
    }
    fn.priority = TInterceptorPriority.AFTER_ALL
    return fn
}

export function SetHeader(...args: Parameters<typeof setHeaderInterceptor>) {
    return Intercept(setHeaderInterceptor(...args))
}

const setCookieInterceptor: (
    ...args: Parameters<ReturnType<typeof useSetCookies>['setCookie']>
) => TInterceptorFn = (name, value, attrs) => {
    const fn: TInterceptorFn = (before, after) => {
        const { setCookie, getCookie } = useSetCookies()
        after(() => {
            if (!getCookie(name)) {
                setCookie(name, value, attrs)
            }
        })
    }
    fn.priority = TInterceptorPriority.AFTER_ALL
    return fn
}

export function SetCookie(...args: Parameters<typeof setCookieInterceptor>) {
    return Intercept(setCookieInterceptor(...args))
}
