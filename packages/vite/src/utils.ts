import { readFileSync } from 'node:fs'
import { builtinModules } from 'node:module'

import { EventLogger } from 'moost'
import type { EnvironmentModuleNode } from 'vite'

export const PLUGIN_NAME = 'moost-vite'

/**
 * Recursively gathers all importer modules upstream from a given module.
 *
 * @param {EnvironmentModuleNode | undefined} moduleNode - The starting module node.
 * @param {Set<EnvironmentModuleNode>} [visited] - A set of visited modules to avoid duplicates.
 * @returns {Set<EnvironmentModuleNode>} A set containing all discovered importer modules (including the start node).
 */
export function gatherAllImporters(
  moduleNode?: EnvironmentModuleNode,
  visited = new Set<EnvironmentModuleNode>()
): Set<EnvironmentModuleNode> {
  if (!moduleNode) {
    return visited
  }
  if (visited.has(moduleNode)) {
    return visited
  }

  visited.add(moduleNode)
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (moduleNode.importers) {
    for (const importer of moduleNode.importers) {
      gatherAllImporters(importer, visited)
    }
  }
  return visited
}

const logger = new EventLogger('', { level: 99 }).createTopic(
  __DYE_DIM__ + __DYE_CYAN__ + PLUGIN_NAME
)
export function getLogger(): EventLogger {
  return logger
}

export function getExternals({ node, workspace }: { node: boolean; workspace: boolean }) {
  const pkg = JSON.parse(readFileSync('package.json', 'utf8').toString()) as {
    dependencies?: Record<string, string>
  }
  const externals = workspace
    ? Object.keys(pkg.dependencies || {})
    : Object.entries(pkg.dependencies || {})
        .filter(([key, ver]) => !ver.startsWith('workspace:'))
        .map(i => i[0])
  if (node) {
    externals.push(
      ...builtinModules, // e.g. 'fs'
      ...builtinModules.map(m => `node:${m}`) // e.g. 'node:fs'
    )
  }
  return externals
}
