import { existsSync, readFileSync, realpathSync } from 'node:fs'
import { builtinModules } from 'node:module'
import { dirname, join } from 'node:path'

/**
 * Packages that make up the moost/wooks runtime. They mint per-module Symbol
 * slot keys, so the whole set must resolve to a single module instance in the
 * production SSR graph.
 */
export const RUNTIME_PACKAGE_PATTERNS = [
  /^moost($|\/)/,
  /^@moostjs\//,
  /^@wooksjs\//,
  /^wooks($|\/)/,
]

export function isRuntimePackage(name: string): boolean {
  return RUNTIME_PACKAGE_PATTERNS.some((re) => re.test(name))
}

/** A package that will be loaded by Node (not the bundler) yet depends on the runtime. */
export interface TExternalRuntimeConsumer {
  /** Package name as it appears in the dependency tree. */
  name: string
  /** Externalized chain leading to this package (empty for a direct external). */
  via: string[]
  /** Which runtime packages it declares as deps/peerDeps. */
  runtimeDeps: string[]
}

const BUILTINS = new Set(builtinModules)

/** Bare npm package name of an import specifier (`vue/server-renderer` → `vue`). */
export function npmPackageName(id: string): string | undefined {
  if (!id || id.startsWith('.') || id.startsWith('/') || id.startsWith('\0')) {
    return undefined
  }
  if (id.startsWith('node:') || id.startsWith('data:') || id.startsWith('virtual:')) {
    return undefined
  }
  const parts = id.split('/')
  const name = id.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0]
  if (!name || (id.startsWith('@') && parts.length < 2)) {
    return undefined
  }
  return BUILTINS.has(name) ? undefined : name
}

interface TPkgJson {
  name?: string
  dependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
  optionalDependencies?: Record<string, string>
}

function readPkgJson(dir: string): TPkgJson | undefined {
  try {
    return JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as TPkgJson
  } catch {
    return undefined
  }
}

/**
 * Locate `name`'s package directory the way Node would from `fromDir`:
 * `<fromDir>/node_modules/<name>`, then each ancestor's `node_modules`.
 * Returns the realpath so pnpm's symlinked layout resolves to the store entry,
 * whose own `node_modules` sibling holds the package's dependencies.
 */
export function findPackageDir(name: string, fromDir: string): string | undefined {
  let dir = fromDir
  for (;;) {
    const candidate = join(dir, 'node_modules', name)
    if (existsSync(join(candidate, 'package.json'))) {
      try {
        return realpathSync(candidate)
      } catch {
        return candidate
      }
    }
    const parent = dirname(dir)
    if (parent === dir) {
      return undefined
    }
    dir = parent
  }
}

function runtimeDepsOf(pkg: TPkgJson): string[] {
  const names = new Set<string>()
  for (const group of [pkg.dependencies, pkg.peerDependencies, pkg.optionalDependencies]) {
    for (const dep of Object.keys(group ?? {})) {
      if (isRuntimePackage(dep)) {
        names.add(dep)
      }
    }
  }
  return [...names]
}

/** Upper bound on visited packages — keeps a pathological tree from stalling the build. */
const MAX_VISITED = 5000

/**
 * Given the bare specifiers left in the SSR build output (i.e. the packages the
 * bundler externalized), find every package Node will load at runtime that
 * depends on the moost/wooks runtime. Each such package resolves its own copy of
 * the runtime from `node_modules` while the bundled runtime lives inside
 * `dist/server` — two instances, split event context.
 *
 * Walks the dependency tree beneath each external (Node loads a package's deps
 * from its own resolution root, so transitive consumers matter too). Packages
 * that are not installed are skipped silently.
 */
export function findExternalRuntimeConsumers(opts: {
  root: string
  externalIds: Iterable<string>
}): TExternalRuntimeConsumer[] {
  const found: TExternalRuntimeConsumer[] = []
  const visited = new Set<string>()
  const queue: { name: string; fromDir: string; via: string[] }[] = []

  for (const id of opts.externalIds) {
    const name = npmPackageName(id)
    if (name && !isRuntimePackage(name) && !visited.has(`root:${name}`)) {
      visited.add(`root:${name}`)
      queue.push({ name, fromDir: opts.root, via: [] })
    }
  }

  while (queue.length > 0 && visited.size < MAX_VISITED) {
    const { name, fromDir, via } = queue.shift()!
    const dir = findPackageDir(name, fromDir)
    if (!dir || visited.has(dir)) {
      continue
    }
    visited.add(dir)
    const pkg = readPkgJson(dir)
    if (!pkg) {
      continue
    }
    const runtimeDeps = runtimeDepsOf(pkg)
    if (runtimeDeps.length > 0) {
      found.push({ name, via, runtimeDeps })
    }
    for (const dep of Object.keys(pkg.dependencies ?? {})) {
      if (!isRuntimePackage(dep)) {
        queue.push({ name: dep, fromDir: dir, via: [...via, name] })
      }
    }
  }

  return found
}

/** Human-readable build warning for {@link findExternalRuntimeConsumers} results. */
export function formatExternalRuntimeConsumersWarning(
  consumers: TExternalRuntimeConsumer[],
): string {
  const lines = consumers.map((c) => {
    const chain = c.via.length > 0 ? ` (loaded via external ${c.via.join(' → ')})` : ''
    return `  - ${c.name}${chain} depends on ${c.runtimeDeps.join(', ')}`
  })
  const direct = [...new Set(consumers.map((c) => (c.via.length > 0 ? c.via[0] : c.name)))]
  return [
    'The moost/wooks runtime is bundled into dist/server, but these externalized packages depend on it and will load a second copy from node_modules:',
    ...lines,
    'Two runtime instances split the event context: useRequest() / useHeaders() / useAuthorization() inside those packages read `undefined` in production only.',
    `Fix: add ${direct.map((d) => `'${d}'`).join(', ')} to ssr.noExternal (or drop them from ssr.external / ssrExternal), or externalize the whole runtime via ssr.external.`,
    'Set ssrExternalCheck: false in moostVite() to silence this check.',
  ].join('\n')
}
