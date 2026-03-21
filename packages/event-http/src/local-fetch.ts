import type { MoostHttp } from './event-http'

/**
 * Patches `globalThis.fetch` so that requests to local paths (starting with `/`)
 * are routed through `MoostHttp` in-process instead of making a network request.
 * Falls back to the original `fetch` when no Moost route matches.
 *
 * Useful for SSR scenarios where server-side code needs to call its own API endpoints
 * without the overhead of a TCP round-trip.
 *
 * @returns A teardown function that restores the original `globalThis.fetch`.
 */
export function enableLocalFetch(http: MoostHttp): () => void {
  const originalFetch = globalThis.fetch
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    if (typeof input === 'string') {
      if (input.startsWith('/')) {
        const response = await http.request(input, init)
        if (response) return response
      }
    } else if (input instanceof URL) {
      if (isLocalOrigin(input)) {
        const response = await http.request(input, init)
        if (response) return response
      }
    } else {
      const url = new URL(input.url)
      if (isLocalOrigin(url)) {
        const response = await http.fetch(input)
        if (response) return response
      }
    }
    return originalFetch(input, init)
  }) as typeof fetch
  return () => {
    globalThis.fetch = originalFetch
  }
}

function isLocalOrigin(url: URL): boolean {
  return url.hostname === 'localhost' || url.hostname === '127.0.0.1'
}
