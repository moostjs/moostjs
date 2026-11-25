import type { IncomingMessage, ServerResponse } from 'node:http'
import { validateHeaderName, validateHeaderValue } from 'node:http'

import { PLUGIN_NAME } from './utils'

/** Name of the dev-server plugin `createSSRServer()` adds for its headers, middlewares and SSR. */
export const SERVER_PLUGIN_NAME = `${PLUGIN_NAME}:server`

/**
 * Connect-style middleware, as `createSSRServer().use()` takes it. Call `next()` to continue,
 * `next(error)` to fail the request.
 */
export type TConnectMiddleware = (
  req: IncomingMessage,
  res: ServerResponse,
  next: (error?: unknown) => void,
) => void

/** Throws, naming the header, when a name or value could not be sent. */
export function validateHeaders(headers: Record<string, string> | null | undefined, from: string) {
  for (const [name, value] of Object.entries(headers ?? {})) {
    try {
      validateHeaderName(name)
      validateHeaderValue(name, value)
    } catch (error) {
      throw new TypeError(
        `[${PLUGIN_NAME}] ${from}: invalid header ${JSON.stringify(name)} — ${(error as Error).message}`,
        { cause: error },
      )
    }
  }
}

/** Sets each of `headers` on the response (later `setHeader` calls still replace them). */
export function setResponseHeaders(res: ServerResponse, headers?: Record<string, string> | null) {
  for (const [name, value] of Object.entries(headers ?? {})) {
    res.setHeader(name, value)
  }
}

/** Rejects an error-handling `(err, req, res, next)` middleware: it would run as a normal one. */
export function assertMiddleware(middleware: TConnectMiddleware) {
  if (typeof middleware !== 'function' || middleware.length >= 4) {
    throw new TypeError(
      `[${PLUGIN_NAME}] createSSRServer().use() takes a (req, res, next) middleware; ` +
        'error-handling (err, req, res, next) middleware is not supported',
    )
  }
}

/**
 * Runs `middlewares` in order, then `done()` — unless one of them answers without calling
 * `next`. A middleware that calls `next(error)`, throws, or returns a rejected promise before
 * calling `next` stops the chain: `done(error)`.
 */
export function runMiddlewares(
  middlewares: TConnectMiddleware[],
  req: IncomingMessage,
  res: ServerResponse,
  done: (error?: unknown) => void,
) {
  let i = 0
  const runNext = () => {
    const middleware = middlewares[i++]
    if (!middleware) {
      done()
      return
    }
    let passed = false
    const next = (error?: unknown) => {
      if (passed) {
        return
      }
      passed = true
      if (error === undefined || error === null) {
        runNext()
      } else {
        done(error || new Error(`A use() middleware failed with ${String(error)}`))
      }
    }
    const fail = (error: unknown) =>
      next(error ?? new Error(`A use() middleware failed with ${String(error)}`))
    let result: unknown
    try {
      result = middleware(req, res, next)
    } catch (error) {
      if (passed) {
        throw error // thrown further down the chain, not by this middleware
      }
      fail(error)
      return
    }
    if (typeof (result as PromiseLike<unknown> | undefined)?.then === 'function') {
      ;(result as PromiseLike<unknown>).then(undefined, (error: unknown) => {
        if (passed) {
          console.error(error)
        } else {
          fail(error)
        }
      })
    }
  }
  runNext()
}

/** The status of a failed request: the error's `status` / `statusCode` (400–599), else `500`. */
function errorStatus(error: unknown): number {
  const { status, statusCode } = (error ?? {}) as { status?: unknown; statusCode?: unknown }
  const code = status ?? statusCode
  return typeof code === 'number' && Number.isInteger(code) && code >= 400 && code <= 599
    ? code
    : 500
}

/** Answers a request a middleware failed: logs the error, sends its status, never its message. */
export function failRequest(res: ServerResponse, error: unknown) {
  console.error(error)
  if (res.writableEnded) {
    return
  }
  if (res.headersSent) {
    res.destroy()
    return
  }
  res.statusCode = errorStatus(error)
  res.end()
}
