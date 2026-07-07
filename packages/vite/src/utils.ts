import type { ServerResponse } from 'node:http'
import { readFileSync } from 'node:fs'
import { builtinModules } from 'node:module'

import { createLogger } from 'moost'
import type { EnvironmentModuleNode } from 'vite'

export const PLUGIN_NAME = 'moost-vite'
export const DEFAULT_SSR_OUTLET = '<!--ssr-outlet-->'
export const DEFAULT_SSR_STATE = '<!--ssr-state-->'
export const DEFAULT_SSR_HEAD = '<!--ssr-head-->'

/**
 * The value an SSR `render(url)` function may return. Only `html` is required;
 * every other field is optional, so a render returning `{ html }` (or
 * `{ html, state }`) keeps working unchanged.
 */
export interface TSSRRenderResult {
  /** Server-rendered app markup, substituted into the `ssrOutlet` marker. */
  html: string
  /**
   * Serialized app state. Wrapped in `<script>window.__SSR_STATE__=…</script>`
   * and substituted into the `ssrState` marker (nothing is emitted when absent).
   */
  state?: string
  /**
   * Ready-to-insert `<head>` tags (`<title>`, `<meta>`, canonical, Open Graph,
   * JSON-LD, …), substituted verbatim into the `ssrHead` marker. This is exactly
   * the shape head managers emit (e.g. unhead's `renderSSRHead(head).headTags`).
   */
  head?: string
  /** HTTP status code for the response (default `200`) — e.g. `404` for a soft-404, `301` for a redirect. */
  status?: number
  /** Extra response headers — e.g. `cache-control`, or `location` alongside `status: 301`. */
  headers?: Record<string, string>
}

/** The three HTML placeholders substituted by {@link sendSSRResponse}. */
export interface TSSRMarkers {
  ssrOutlet: string
  ssrState: string
  ssrHead: string
}

/**
 * Applies an SSR render result to the HTTP response: sets the status code and
 * headers, then substitutes the outlet, state and head markers into the HTML
 * template. Shared by all three render call sites (the dev middleware, the dev
 * `createSSRServer` branch and the prod `createSSRServer` branch) so the render
 * contract stays identical across them.
 *
 * Fully backwards compatible: every field beyond `html` is optional, a missing
 * marker in the template is a no-op `String.replace`, and headers from the render
 * result are applied after the default `Content-Type: text/html` so a render can
 * override it. Replacements use a function argument so `$`-sequences in the
 * rendered payloads (JSON state, JSON-LD `<head>` tags) are inserted literally
 * rather than interpreted as `String.replace` special patterns.
 */
export function sendSSRResponse(
  res: ServerResponse,
  template: string,
  markers: TSSRMarkers,
  result: TSSRRenderResult,
): void {
  res.statusCode = result.status ?? 200
  res.setHeader('Content-Type', 'text/html')
  if (result.headers) {
    for (const [key, value] of Object.entries(result.headers)) {
      res.setHeader(key, value)
    }
  }
  const stateScript = result.state ? `<script>window.__SSR_STATE__=${result.state}</script>` : ''
  res.end(
    template
      .replace(markers.ssrOutlet, () => result.html)
      .replace(markers.ssrState, () => stateScript)
      .replace(markers.ssrHead, () => result.head ?? ''),
  )
}

export function entryBasename(entry: string): string {
  return entry.split('/').pop()!.replace(/\.ts$/, '.js')
}

/**
 * Normalizes the `prefix` option (single mount or list of mounts) into a list of
 * normalized entries: leading slash ensured, trailing slash stripped.
 * Returns `undefined` when no prefix is configured (empty input included) —
 * the "route everything through Moost first" mode.
 */
export function normalizePrefixes(prefix?: string | string[] | null): string[] | undefined {
  if (!prefix) {
    return undefined
  }
  const normalized = (Array.isArray(prefix) ? prefix : [prefix]).filter(Boolean).map((entry) => {
    let value = entry
    if (!value.startsWith('/')) {
      value = `/${value}`
    }
    if (value.endsWith('/')) {
      value = value.slice(0, -1)
    }
    return value
  })
  return normalized.length > 0 ? normalized : undefined
}

/**
 * Checks whether a request url falls under any of the normalized prefix mounts:
 * exact match, a path segment below it, or the mount itself with a query string.
 */
export function matchesPrefix(url: string, prefixes: string[]): boolean {
  return prefixes.some((prefix) => {
    if (!url.startsWith(prefix)) {
      return false
    }
    const next = url[prefix.length]
    return next === undefined || next === '/' || next === '?'
  })
}

/**
 * Recursively gathers all importer modules upstream from a given module.
 *
 * @param {EnvironmentModuleNode | undefined} moduleNode - The starting module node.
 * @param {Set<EnvironmentModuleNode>} [visited] - A set of visited modules to avoid duplicates.
 * @returns {Set<EnvironmentModuleNode>} A set containing all discovered importer modules (including the start node).
 */
export function gatherAllImporters(
  moduleNode?: EnvironmentModuleNode,
  visited = new Set<EnvironmentModuleNode>(),
): Set<EnvironmentModuleNode> {
  if (!moduleNode) {
    return visited
  }
  if (visited.has(moduleNode)) {
    return visited
  }

  visited.add(moduleNode)
  if (moduleNode.importers) {
    for (const importer of moduleNode.importers) {
      gatherAllImporters(importer, visited)
    }
  }
  return visited
}

const logger = createLogger({ level: 99 }).createTopic(__DYE_DIM__ + __DYE_CYAN__ + PLUGIN_NAME)
export function getLogger() {
  return logger
}

function escapeRegex(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function getExternals({ node, workspace }: { node: boolean; workspace: boolean }) {
  const pkg = JSON.parse(readFileSync('package.json', 'utf8').toString()) as {
    dependencies?: Record<string, string>
  }
  const packageNames = workspace
    ? Object.keys(pkg.dependencies || {})
    : Object.entries(pkg.dependencies || {})
        .filter(([key, ver]) => !ver.startsWith('workspace:'))
        .map((i) => i[0])
  const externals: RegExp[] = packageNames.map((name) => new RegExp(`^${escapeRegex(name)}(/|$)`))
  if (node) {
    externals.push(
      ...builtinModules.map((m) => new RegExp(`^${escapeRegex(m)}(/|$)`)),
      ...builtinModules.map((m) => new RegExp(`^node:${escapeRegex(m)}(/|$)`)),
    )
  }
  return externals
}
