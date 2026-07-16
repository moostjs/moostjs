import type { TInfactEventDetail } from '@prostojs/infact'

import type { TControllerOverview } from '../types'

/**
 * Optional 5th argument that @prostojs/infact (≥0.5.0) passes to its `on`
 * event sink for DI errors — re-exported under the local name the rest of
 * the diagnostics code uses.
 */
export type TInfactErrorDetail = TInfactEventDetail

/**
 * Structural view of a Moost app used by the diagnostics scans. Typed
 * structurally (instead of importing the Moost class) because this module is
 * consumed by `metadata/infact.ts`, which `moost.ts` itself depends on — a
 * value import of Moost here would create an import cycle.
 */
export interface TDiagnosticsSource {
  getControllersOverview: () => TControllerOverview[]
}

/**
 * Minimal WeakRef surface kept per registered source. Doubles as the unit
 * seam for deterministically testing dead-ref pruning (GC cannot be forced
 * from a test, so specs register a ref whose `deref()` returns `undefined`).
 */
export interface TDiagnosticsSourceRef {
  deref: () => TDiagnosticsSource | undefined
}

let sourceRefs: TDiagnosticsSourceRef[] = []

/** Dereferences the registered sources, pruning refs whose target was collected. */
function scanLiveSources(): TDiagnosticsSource[] {
  const live: TDiagnosticsSource[] = []
  const keep: TDiagnosticsSourceRef[] = []
  for (const ref of sourceRefs) {
    const source = ref.deref()
    if (source) {
      live.push(source)
      keep.push(ref)
    }
  }
  sourceRefs = keep
  return live
}

/**
 * Registers a Moost app as a source for DI diagnostics scans (D4 scope
 * hints). Held via `WeakRef` so a dropped app never leaks; registering the
 * same app again is a no-op.
 */
export function registerDiagnosticsSource(source: TDiagnosticsSource) {
  if (scanLiveSources().includes(source)) {
    return
  }
  sourceRefs.push(new WeakRef(source))
}

/** @internal Unit seam: registers a pre-built (possibly dead) ref to test pruning. */
export function registerDiagnosticsSourceRef(ref: TDiagnosticsSourceRef) {
  sourceRefs.push(ref)
}

/** @internal Number of currently registered source refs (prune assertions in tests). */
export function getDiagnosticsSourceCount() {
  return sourceRefs.length
}

/** @internal Drops all registered sources (test isolation). */
export function resetDiagnosticsSources() {
  sourceRefs = []
}

/**
 * Scans the registered apps' controllers for a class-scoped `@Provide`
 * carrying `token` and returns the provider controller class names. Both
 * string and symbol keys are checked — symbol class-tokens match by identity
 * because infact keys them via `Symbol.for` (same class source, same symbol).
 */
export function findTokenProviders(token: string | symbol): string[] {
  const providers: string[] = []
  for (const source of scanLiveSources()) {
    for (const entry of source.getControllersOverview()) {
      const keys = Reflect.ownKeys(entry.meta?.provide ?? {})
      if (keys.includes(token) && !providers.includes(entry.type.name)) {
        providers.push(entry.type.name)
      }
    }
  }
  return providers
}

const CLASS_SOURCE_RE = /^class\s+([\w$]+)/

/** Renders a provide token readably: strings as-is, class-source symbols by class name. */
function stringifyToken(token: string | symbol): string {
  if (typeof token === 'string') {
    return token
  }
  const description = token.description ?? token.toString()
  const match = CLASS_SOURCE_RE.exec(description)
  return match ? match[1] : description
}

/**
 * D4: when an unresolved `@Inject(token)` IS provided somewhere — via a
 * class-scoped `@Provide` on a sibling controller — teaches the actual
 * scoping rule (providers flow parent → child, never to siblings) and names
 * both remedies. Returns `undefined` when no provider was found.
 */
export function formatScopeHint(
  token: string | symbol,
  providerNames: string[],
): string | undefined {
  if (providerNames.length === 0) {
    return undefined
  }
  const subject =
    providerNames.length === 1
      ? `sibling controller ${providerNames[0]}`
      : `sibling controllers ${providerNames.join(', ')}`
  return (
    `Token "${stringifyToken(token)}" is provided on ${subject} via class-scoped @Provide, ` +
    "which is only visible to that controller's own subtree " +
    '(providers flow parent → child through @ImportController, never to siblings). ' +
    'Move it to app.setProvideRegistry(...) or to a common parent @ImportController.'
  )
}

/**
 * D2: renders an infact instantiation error with the consumer-side context
 * carried by `detail` — parameter position/label/type plus the resolution
 * hierarchy — as one multi-line message (single `logger.error` call). The
 * `import type` hint is already appended to `message` upstream by infact and
 * is deliberately not duplicated here.
 */
export function formatInfactErrorContext(
  targetClassName: string,
  message: string,
  detail: TInfactErrorDetail,
): string {
  let head = `Failed to instantiate ${targetClassName}`
  if (typeof detail.paramIndex === 'number') {
    const qualifiers = [
      detail.paramLabel === undefined ? '' : `label "${detail.paramLabel}"`,
      detail.paramTypeName === undefined ? '' : `type ${detail.paramTypeName}`,
    ]
      .filter(Boolean)
      .join(', ')
    head += `: constructor parameter #${detail.paramIndex}${qualifiers ? ` (${qualifiers})` : ''}`
  }
  const lines = [`${head} — ${message}`]
  if (detail.hierarchy && detail.hierarchy.length > 0) {
    lines.push(`  Hierarchy: ${detail.hierarchy.join(' → ')}`)
  }
  return lines.join('\n')
}
