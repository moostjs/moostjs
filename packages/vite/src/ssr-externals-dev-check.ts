import type { TSplitPackage } from './ssr-externals-check'
import {
  escapeRegExp,
  findPackageDir,
  findSplitPackages,
  formatSplitLines,
  PLUGIN_NO_EXTERNAL,
  readPkgJson,
  SHARED_STATE_PACKAGE_PATTERNS,
} from './ssr-externals-check'

/** The SSR environment's externalization config (`resolve.external` / `resolve.noExternal`). */
export interface TDevExternalConfig {
  external?: true | string[]
  noExternal?: boolean | string | RegExp | (string | RegExp)[]
}

const toArray = <T>(v: T | T[]): T[] => (Array.isArray(v) ? v : [v])

/** A `noExternal` string entry is a glob over package names (`@acme/*`), as in Vite's filter. */
function globToRegExp(glob: string): RegExp {
  const source = glob
    .split('**')
    .map((part) =>
      part
        .split('*')
        .map((chunk) => escapeRegExp(chunk))
        .join('[^/]*'),
    )
    .join('.*')
  return new RegExp(`^${source}$`)
}

/**
 * Whether Vite's dev SSR module runner evaluates its own copy of a package —
 * mirroring Vite's externalization rules for bare imports: listed in `external`
 * → external; matched by `noExternal` → inlined; otherwise external when it
 * resolves into `node_modules`, inlined when it is linked (a workspace package
 * outside `node_modules`). Packages that do not resolve from `root` count as
 * external — the runner never loads them.
 */
export function createDevInlineCheck(
  root: string,
  config: TDevExternalConfig,
): (name: string) => boolean {
  const { external = [], noExternal = [] } = config
  const noExternalPatterns =
    typeof noExternal === 'boolean'
      ? []
      : toArray(noExternal).map((p) => (p instanceof RegExp ? p : globToRegExp(p)))
  const cache = new Map<string, boolean>()
  const decide = (name: string): boolean => {
    if (external !== true && external.includes(name)) {
      return false
    }
    if (typeof noExternal === 'boolean') {
      return noExternal
    }
    if (noExternalPatterns.some((re) => re.test(name))) {
      return true
    }
    if (external === true) {
      return false
    }
    const dir = findPackageDir(name, root)
    return dir !== undefined && !dir.replaceAll('\\', '/').includes('/node_modules/')
  }
  return (name) => {
    let inlined = cache.get(name)
    if (inlined === undefined) {
      inlined = decide(name)
      cache.set(name, inlined)
    }
    return inlined
  }
}

/** Package names `root` depends on directly, from every dependency group of its package.json. */
function rootDependencies(root: string): string[] {
  const pkg = readPkgJson(root)
  if (!pkg) {
    return []
  }
  const names = new Set<string>()
  for (const group of [
    pkg.dependencies,
    pkg.devDependencies,
    pkg.peerDependencies,
    pkg.optionalDependencies,
  ]) {
    for (const dep of Object.keys(group ?? {})) {
      names.add(dep)
    }
  }
  return [...names]
}

/** Is `entry` (a `noExternal` entry) the plugin's own (`PLUGIN_NO_EXTERNAL`)? */
const isPluginOwnEntry = (entry: string | RegExp) =>
  entry instanceof RegExp && entry.source === PLUGIN_NO_EXTERNAL.source

/**
 * The dev-server counterpart of {@link findSplitPackages}. In `vite serve` the
 * SSR module runner evaluates app code and every *inlined* dependency, while
 * Node loads every *externalized* one natively. When an external package
 * depends on a watched package the runner inlines (forced by `ssr.noExternal`,
 * or a linked workspace package), the two sides run separate copies of it —
 * the same split as in production, only in dev.
 *
 * The externals walked are the root package's direct dependencies the runner
 * does not inline (and their dependency trees). The plugin itself is always
 * loaded by Node and works on Node's `moost` (DI cleanup on reload, init
 * capture), so an inlined `moost` is reported against `@moostjs/vite` too.
 *
 * Skips the walk when nothing watched can be inlined: no `noExternal` entry
 * beyond the plugin's own, and no watched direct dependency that is linked.
 */
export function findDevSplitPackages(opts: {
  root: string
  config: TDevExternalConfig
  patterns?: RegExp[]
}): TSplitPackage[] {
  const patterns = opts.patterns ?? SHARED_STATE_PACKAGE_PATTERNS
  const isInlined = createDevInlineCheck(opts.root, opts.config)
  // The plugin's own package is watched (`@moostjs/*`) and inlined by its own
  // `noExternal` entry, but nothing loaded natively depends on it — leaving it in
  // would defeat the skip below for every app (all of them list `@moostjs/vite`).
  const isInlinedWatched = (name: string) =>
    !PLUGIN_NO_EXTERNAL.test(name) && patterns.some((re) => re.test(name)) && isInlined(name)
  const deps = rootDependencies(opts.root)
  const { noExternal = [] } = opts.config
  const userNoExternal =
    noExternal === true ||
    (typeof noExternal !== 'boolean' && toArray(noExternal).some((e) => !isPluginOwnEntry(e)))
  if (!userNoExternal && !deps.some((dep) => isInlinedWatched(dep))) {
    return []
  }
  const found = findSplitPackages({
    root: opts.root,
    externalIds: deps.filter((dep) => !isInlined(dep)),
    bundledPackages: { has: isInlinedWatched },
    patterns,
  })
  if (isInlined('moost') && findPackageDir('moost', opts.root)) {
    found.unshift({ name: '@moostjs/vite', via: [], splitDeps: ['moost'] })
  }
  return found
}

/** Human-readable dev-server warning for {@link findDevSplitPackages} results. */
export function formatDevSplitPackagesWarning(splits: TSplitPackage[]): string {
  const inlined = [...new Set(splits.flatMap((s) => s.splitDeps))]
  const consumers = [
    ...new Set(
      splits
        .map((s) => (s.via.length > 0 ? s.via[0] : s.name))
        .filter((n) => n !== '@moostjs/vite'),
    ),
  ]
  const addConsumers =
    consumers.length > 0
      ? `, or add ${consumers.map((d) => `'${d}'`).join(', ')} to ssr.noExternal so the runner evaluates those as well`
      : ''
  return [
    "These packages are loaded natively by Node in dev, but depend on packages Vite's SSR module runner evaluates its own copy of (ssr.noExternal, or a linked workspace package):",
    ...formatSplitLines(splits, 'inlined'),
    'Two copies of a package split its module state — class identity ("Class is not Injectable" when a library resolves an adapter through DI), DI registries and event-context slots stop matching across the boundary.',
    `Fix: let Vite externalize ${inlined.map((d) => `'${d}'`).join(', ')} in dev (remove it from ssr.noExternal; list a linked workspace package in ssr.external)${addConsumers}.`,
    'Set ssrExternalCheck: false in moostVite() to silence this check.',
  ].join('\n')
}
