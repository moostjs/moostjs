import { useRequest } from '@wooksjs/event-http'
import { defineInterceptorFn, Intercept, TInterceptorPriority } from 'moost'

/**
 * Creates an interceptor that sets the maximum allowed inflated body size in bytes.
 *
 * @param n - Maximum body size in bytes after decompression.
 * @returns Interceptor function to enforce the limit.
 */
export const globalBodySizeLimit = (n: number) =>
  defineInterceptorFn(() => {
    useRequest().setMaxInflated(n)
  }, TInterceptorPriority.BEFORE_ALL)

/**
 * Creates an interceptor that sets the maximum allowed compressed body size in bytes.
 *
 * @param n - Maximum body size in bytes before decompression.
 * @returns Interceptor function to enforce the limit.
 */
export const globalCompressedBodySizeLimit = (n: number) =>
  defineInterceptorFn(() => {
    useRequest().setMaxCompressed(n)
  }, TInterceptorPriority.BEFORE_ALL)

/**
 * Creates an interceptor that sets the timeout for reading the request body.
 *
 * @param n - Timeout in milliseconds.
 * @returns Interceptor function to enforce the timeout.
 */
export const globalBodyReadTimeoutMs = (n: number) =>
  defineInterceptorFn(() => {
    useRequest().setReadTimeoutMs(n)
  }, TInterceptorPriority.BEFORE_ALL)

/**
 * Decorator to limit the maximum inflated body size for the request. Default: 10 MB
 *
 * @param n - Maximum body size in bytes after decompression.
 */
export const BodySizeLimit = (n: number) => Intercept(globalBodySizeLimit(n))

/**
 * Decorator to limit the maximum compressed body size for the request. Default: 1 MB
 *
 * @param n - Maximum body size in bytes before decompression.
 */
export const CompressedBodySizeLimit = (n: number) => Intercept(globalCompressedBodySizeLimit(n))

/**
 * Decorator to set a timeout (in milliseconds) for reading the request body. Default: 10 s
 *
 * @param n - Timeout duration in milliseconds.
 */
export const BodyReadTimeoutMs = (n: number) => Intercept(globalBodyReadTimeoutMs(n))
