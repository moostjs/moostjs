import { existsSync, readFileSync, realpathSync } from 'node:fs'
import { builtinModules } from 'node:module'
import { dirname, join } from 'node:path'

/**
 * Packages that make up the moost/wooks runtime. They mint per-module Symbol
 * slot keys, so the whole set must resolve to a single module instance in the
 * production SSR graph. This is the scope of the single-instance *guard*
 * (force-bundling under an explicit `noExternal` list) — the build *check*
 * watches the wider {@link SHARED_STATE_PACKAGE_PATTERNS}.
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

/**
 * Packages the build check watches by default: the moost/wooks runtime plus the
 * `@atscript/*` family. All of them keep module-level state — Symbol slot keys,
 * DI/model registries, class identity used by `instanceof` — so a second copy
 * loaded by Node breaks lookups that the bundled copy filled in.
 *
 * This is deliberately wider than {@link RUNTIME_PACKAGE_PATTERNS}: the guard
 * that force-bundles packages covers the runtime only, while the check merely
 * reports what the output shows.
 */
export const SHARED_STATE_PACKAGE_PATTERNS: RegExp[] = [...RUNTIME_PACKAGE_PATTERNS, /^@atscript\//]

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Build the watched-package patterns for the check: the defaults plus the
 * user's extras. A `RegExp` is used as is, a string ending with `/` matches a
 * scope/prefix (`'@acme/'` → every `@acme/*` package), any other string is an
 * exact package name.
 */
export function compilePackagePatterns(extra?: (string | RegExp)[]): RegExp[] {
  const patterns = [...SHARED_STATE_PACKAGE_PATTERNS]
  for (const item of extra ?? []) {
    if (item instanceof RegExp) {
      patterns.push(item)
    } else if (item.endsWith('/')) {
      patterns.push(new RegExp(`^${escapeRegExp(item)}`))
    } else {
      patterns.push(new RegExp(`^${escapeRegExp(item)}$`))
    }
  }
  return patterns
}

/** An externalized package that depends on a package bundled into the output. */
export interface TSplitPackage {
  /** Package name as it appears in the dependency tree. */
  name: string
  /** Externalized chain leading to this package (empty for a direct external). */
  via: string[]
  /** Watched packages it declares as deps/peerDeps that are bundled into the output. */
  splitDeps: string[]
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

/**
 * Package names the bundler inlined into the output, derived from the module
 * ids of the emitted chunks. Ids under `node_modules` name their package after
 * the LAST `node_modules/` segment, which also yields the right name for pnpm
 * store paths (`…/node_modules/.pnpm/pkg@1.0.0/node_modules/pkg/index.mjs`).
 * Virtual ids and app sources (no `node_modules`) are ignored.
 */
export function bundledPackagesFromModuleIds(moduleIds: Iterable<string>): Set<string> {
  const packages = new Set<string>()
  const marker = '/node_modules/'
  for (const raw of moduleIds) {
    if (!raw || raw.startsWith('\0')) {
      continue
    }
    const id = raw.replaceAll('\\', '/')
    const at = id.lastIndexOf(marker)
    if (at === -1) {
      continue
    }
    const name = npmPackageName(id.slice(at + marker.length))
    if (name) {
      packages.add(name)
    }
  }
  return packages
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

/** Deps of `pkg` that are watched packages AND were bundled into the output. */
function splitDepsOf(
  pkg: TPkgJson,
  patterns: RegExp[],
  bundledPackages: ReadonlySet<string>,
): string[] {
  const names = new Set<string>()
  for (const group of [pkg.dependencies, pkg.peerDependencies, pkg.optionalDependencies]) {
    for (const dep of Object.keys(group ?? {})) {
      if (bundledPackages.has(dep) && patterns.some((re) => re.test(dep))) {
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
 * bundler externalized) and the package names it bundled, find every package
 * Node will load at runtime that depends on a bundled shared-state package.
 * Such a package resolves its own copy from `node_modules` while the bundled
 * copy lives inside `dist/server` — two instances, split module state.
 *
 * Walks the dependency tree beneath each external (Node loads a package's deps
 * from its own resolution root, so transitive consumers matter too), but never
 * descends into a bundled dep: the fix belongs to the external consumer.
 * Packages that are not installed are skipped silently.
 */
export function findSplitPackages(opts: {
  root: string
  externalIds: Iterable<string>
  bundledPackages: ReadonlySet<string>
  patterns?: RegExp[]
}): TSplitPackage[] {
  const patterns = opts.patterns ?? SHARED_STATE_PACKAGE_PATTERNS
  const found: TSplitPackage[] = []
  const visited = new Set<string>()
  const queue: { name: string; fromDir: string; via: string[] }[] = []

  for (const id of opts.externalIds) {
    const name = npmPackageName(id)
    if (name && !visited.has(`root:${name}`)) {
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
    const splitDeps = splitDepsOf(pkg, patterns, opts.bundledPackages)
    if (splitDeps.length > 0) {
      found.push({ name, via, splitDeps })
    }
    for (const dep of Object.keys(pkg.dependencies ?? {})) {
      if (!opts.bundledPackages.has(dep)) {
        queue.push({ name: dep, fromDir: dir, via: [...via, name] })
      }
    }
  }

  return found
}

/** Human-readable build warning for {@link findSplitPackages} results. */
export function formatSplitPackagesWarning(splits: TSplitPackage[]): string {
  const lines = splits.map((s) => {
    const chain = s.via.length > 0 ? ` (loaded via external ${s.via.join(' → ')})` : ''
    const deps = s.splitDeps.map((d) => `${d} (bundled)`).join(', ')
    return `  - ${s.name}${chain} depends on ${deps}`
  })
  const direct = [...new Set(splits.map((s) => (s.via.length > 0 ? s.via[0] : s.name)))]
  return [
    'These externalized packages depend on packages that are bundled into dist/server, so Node will load a second copy of them from node_modules:',
    ...lines,
    'Two copies of a package split its module state — event-context slots, DI registries and class identity (instanceof) stop matching across the boundary, in production only. Symptoms: "Cannot read properties of undefined (reading \'headers\')" inside a wooks composable, or a database adapter creating an empty table where a managed view was declared.',
    `Fix: keep each shared package and everything that depends on it on the same side — add ${direct.map((d) => `'${d}'`).join(', ')} to ssr.noExternal (or drop them from ssr.external / ssrExternal), or externalize the whole family (for example every @atscript/* package, or the whole moost/wooks runtime) via ssr.external.`,
    'Set ssrExternalCheck: false in moostVite() to silence this check, or ssrExternalCheck: { packages: [...] } to watch more packages.',
  ].join('\n')
}
