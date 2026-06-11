import { readFileSync } from 'node:fs'
import { builtinModules } from 'node:module'

import { createLogger } from 'moost'
import type { EnvironmentModuleNode } from 'vite'

export const PLUGIN_NAME = 'moost-vite'
export const DEFAULT_SSR_OUTLET = '<!--ssr-outlet-->'
export const DEFAULT_SSR_STATE = '<!--ssr-state-->'

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
  return prefixes.some(
    (prefix) => url === prefix || url.startsWith(`${prefix}/`) || url.startsWith(`${prefix}?`),
  )
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
