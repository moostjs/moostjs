import { Intercept, TInterceptorFn, TInterceptorPriority, defineInterceptorFn } from 'moost'
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

/**
 * Set Header for Request Handler
 * 
 * ```ts
 * import { Get, SetHeader } from '@moostjs/event-http';
 * import { Controller } from 'moost';
 * 
 * @Controller()
 * export class ExampleController {
 *   @Get('test')
 *   // setting header for request handler
 *   @SetHeader('x-server', 'my-server')
 *   testHandler() {
 *     return '...'
 *   }
 * }
 * ```
 * 
 * ```ts
 * import { Get, SetHeader } from '@moostjs/event-http';
 * import { Controller } from 'moost';
 *
 * @Controller()
 * export class ExampleController {
 *   @Get('test')
 *   // setting header only if status = 400
 *   @SetHeader('content-type', 'text/plain', { status: 400 })
 *   testHandler() {
 *     return '...'
 *   }
 * }
 * ```
 * 
 * @param name  name of header
 * @param value value for header
 * @param options options { status?: number, force?: boolean }
 */
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

/**
 * Set Cookie for Request Handler
 * ```ts
 * import { Get, SetCookie } from '@moostjs/event-http';
 * import { Controller } from 'moost';
 *
 * @Controller()
 * export class ExampleController {
 *   @Get('test')
 *   // setting 'my-cookie' = 'value' with maxAge of 10 minutes
 *   @SetCookie('my-cookie', 'value', { maxAge: '10m' })
 *   testHandler() {
 *     return '...'
 *   }
 * }
 * ```
 * 
 * @param name  name of cookie
 * @param value value for cookie
 * @param attrs cookie attributes
 */
export function SetCookie(...args: Parameters<typeof setCookieInterceptor>) {
    return Intercept(setCookieInterceptor(...args))
}

const setStatusInterceptor = (code: number, opts?: { force?: boolean }) => {
    return defineInterceptorFn((before, after) => {
        const status = useStatus()
        after(() => {
            if (!status.isDefined || opts?.force) {
                status.value = code
            }
        })
    })
}

/**
 * Set Response Status for Request Handler
 * 
 * ```ts
 * import { Get, SetStatus } from '@moostjs/event-http';
 * import { Controller } from 'moost';
 *
 * @Controller()
 * export class ExampleController {
 *   @Get('test')
 *   @SetStatus(201)
 *   testHandler() {
 *     return '...'
 *   }
 * }
 * ```
 * @param code number 
 * @param opts optional { force?: boolean }
 */
export function SetStatus(...args: Parameters<typeof setStatusInterceptor>) {
    return Intercept(setStatusInterceptor(...args))
}
