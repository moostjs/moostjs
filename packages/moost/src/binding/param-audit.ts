import type { TMoostParamsMetadata } from '../metadata'

/** Identifies where the audited params belong: a class constructor or a handler method. */
export interface TParamAuditContext {
  className: string
  /** Method name owning the params; omit for constructor params. */
  methodName?: string
}

/**
 * `fatal-capable` findings may reject `init()` (only non-optional constructor
 * params — they would fail at instantiation anyway); `warn-only` findings are
 * always logged as warnings and never thrown (silent `undefined` is legal there).
 */
export type TParamAuditSeverity = 'fatal-capable' | 'warn-only'

/** A single diagnostic produced by {@link auditParams}. */
export interface TParamAuditFinding {
  message: string
  severity: TParamAuditSeverity
}

/** Mode for the bind-time param-type audit (see `TMoostOptions['diagnostics']`). */
export type TParamAuditMode = 'error' | 'warn' | 'off'

/**
 * Resolves the effective param-audit mode: an explicit setting wins; otherwise
 * `'error'` in dev (`NODE_ENV !== 'production'`) and `'warn'` in production.
 */
export function resolveParamAuditMode(setting?: TParamAuditMode): TParamAuditMode {
  if (setting) {
    return setting
  }
  return process.env.NODE_ENV === 'production' ? 'warn' : 'error'
}

/**
 * True when the param carries no explicit resolution (`@Resolve`-based
 * decorators, `@Inject`, `@Circular`) and its emitted design type is unusable
 * for DI — `Object` (class erased by `import type`, or an interface/union) or
 * `undefined` (circular import). Such a param falls through to
 * `infact.get(param.type)` and fails there or silently injects `undefined`.
 */
function isBrokenFallThrough(param: TMoostParamsMetadata): boolean {
  return (
    !param.resolver &&
    !param.inject &&
    !param.circular &&
    (param.type === Object || param.type === undefined)
  )
}

function buildMessage(ctx: TParamAuditContext, index: number, param: TMoostParamsMetadata): string {
  const where = `[moost] ${ctx.className}.${ctx.methodName ?? 'constructor'} parameter #${index}`
  if (!ctx.methodName) {
    return param.type === undefined
      ? `${where} has no emitted design type — usually a circular import. Use @Circular(() => Type).`
      : `${where} has type Object — its class was likely imported with 'import type', or it is ` +
          `an interface/union type. Use a value import, an explicit @Inject(token) or @Resolve(), ` +
          `or mark it @Optional() to silence.`
  }
  return param.type === undefined
    ? `${where} has no emitted design type (usually a circular import) and no param decorator — ` +
        `it will resolve to undefined at event time. Add a param decorator (e.g. @Param/@Body) ` +
        `or @Resolve().`
    : `${where} has type Object and no param decorator — it will resolve to undefined at event ` +
        `time. Add a param decorator (e.g. @Param/@Body) or @Resolve(); if the type is a class ` +
        `imported with 'import type', use a value import.`
}

function severityOf(ctx: TParamAuditContext, param: TMoostParamsMetadata): TParamAuditSeverity {
  if (ctx.methodName) {
    return 'warn-only'
  }
  return param.optional || param.nullable ? 'warn-only' : 'fatal-capable'
}

/**
 * D1 bind-time param audit: returns a finding for every param that will fall
 * through to DI class-instantiation with a broken emitted type (`Object` or
 * `undefined`) and no explicit resolution. Pure — the caller decides how to
 * log/throw (see `Moost.init()`).
 */
export function auditParams(
  params: TMoostParamsMetadata[] | undefined,
  ctx: TParamAuditContext,
): TParamAuditFinding[] {
  const findings: TParamAuditFinding[] = []
  for (const [index, param] of (params || []).entries()) {
    // metadata params arrays can be sparse — skip holes
    if (param && isBrokenFallThrough(param)) {
      findings.push({
        message: buildMessage(ctx, index, param),
        severity: severityOf(ctx, param),
      })
    }
  }
  return findings
}

/** Formats the aggregate error thrown by `init()` when fatal-capable findings exist. */
export function formatParamAuditError(findings: TParamAuditFinding[]): string {
  const list = findings.map((f) => `  - ${f.message}`).join('\n')
  return (
    `[moost] DI param audit failed (${findings.length} finding${findings.length === 1 ? '' : 's'}):\n` +
    `${list}\n` +
    `Set diagnostics: { paramTypes: 'warn' } (or 'off') on Moost options to downgrade.`
  )
}
