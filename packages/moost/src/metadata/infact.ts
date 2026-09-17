import type { TInfactClassMeta } from '@prostojs/infact'
import { Infact } from '@prostojs/infact'
import { getConstructor } from '@prostojs/mate'
import { useLogger } from '@wooksjs/event-core'

import { useScopeId } from '../adapter-utils'
import type { TFunction } from '../common-types'
import { getDefaultLogger } from '../logger'
import type { TPipeData } from '../pipes'
import { runPipes } from '../pipes/run-pipes'
import type { TInfactErrorDetail } from './diagnostics'
import { findTokenProviders, formatInfactErrorContext, formatScopeHint } from './diagnostics'
import type { TMoostMetadata, TMoostParamsMetadata } from './moost-metadata'
import { getMoostMate } from './moost-metadata'

const sharedMoostInfact = getNewMoostInfact()
const INFACT_BANNER = `${__DYE_DIM__ + __DYE_MAGENTA__}infact`
interface TInfactLoggingOptions {
  newInstance?: true | false | 'FOR_EVENT' | 'SINGLETON'
  warn?: true | false
  error?: true | false
}

let loggingOptions: TInfactLoggingOptions = {
  newInstance: 'SINGLETON',
  warn: true,
  error: true,
}

/** Configures which Infact DI events are logged (instance creation, warnings, errors). */
export function setInfactLoggingOptions(options: TInfactLoggingOptions) {
  loggingOptions = {
    ...loggingOptions,
    ...options,
  }
}

/** Returns the shared Infact DI container used by Moost for dependency injection. */
export function getMoostInfact() {
  return sharedMoostInfact
}

/**
 * Every SINGLETON instance currently held by an Infact container's **global**
 * registry (per-event `scopes` registries are excluded — those instances are
 * torn down with their event).
 *
 * Infact keeps the registry as a protected symbol-keyed object; this helper
 * centralizes the one cast needed to read it, so consumers
 * (`Moost.dispose()`, the `@moostjs/vite` dev plugin) do not each re-derive it.
 */
export function getInfactSingletonInstances(
  infact: ReturnType<typeof getMoostInfact> = getMoostInfact(),
): object[] {
  const { registry } = infact as unknown as { registry: Record<symbol, object> }
  return Object.getOwnPropertySymbols(registry)
    .map((k) => registry[k])
    .filter(Boolean)
}

interface TCustom {
  pipes?: TPipeData[]
}

const scopeVarsMap = new Map<string | symbol, unknown>()

/**
 * Define global scope name to be used with `@InjectFromScope` and `@InjectScopeVars` decorators
 *
 * You can read scoped vars with `getInfactScopeVars`
 * @param name scope name
 * @param scopeVars key-value object as scoped vars
 */
export function defineInfactScope<T extends object>(name: string | symbol, scopeVars: T) {
  scopeVarsMap.set(name, scopeVars)
  getMoostInfact().registerScope(name)
}

/**
 * Read scoped vars defined with `defineInfactScope`
 * @param name scope name
 * @returns key-value object as scoped vars
 */
export function getInfactScopeVars<T extends object>(name: string | symbol) {
  return scopeVarsMap.get(name) as T | undefined
}

type TInfactEventName = 'new-instance' | 'warn' | 'error'

/** Applies the `setInfactLoggingOptions` filters to an Infact event. */
function shouldLogInfactEvent(event: TInfactEventName, targetClass: TFunction): boolean {
  if (event === 'warn') {
    return !!loggingOptions.warn
  }
  if (event === 'error') {
    return !!loggingOptions.error
  }
  // 'new-instance'
  const scope = getMoostMate().read(targetClass)?.injectable || 'SINGLETON'
  return (
    loggingOptions.newInstance !== false &&
    (loggingOptions.newInstance === scope ||
      (loggingOptions.newInstance === 'SINGLETON' && scope === true))
  )
}

/** Renders the DI resolution-hierarchy breadcrumb (`⋱ A → B`). */
function formatHierarchy(args?: unknown[]): string {
  return `${__DYE_DIM__ + __DYE_BLUE__}⋱ ${args?.map(String).join(' → ') || ''}`
}

function formatNewInstanceArg(a: unknown): string {
  switch (typeof a) {
    case 'number':
    case 'boolean': {
      return `${__DYE_YELLOW__}${a}${__DYE_DIM__ + __DYE_BLUE__}`
    }
    case 'string': {
      return `${__DYE_GREEN_BRIGHT__}"${a.slice(0, 1)}..."${__DYE_DIM__ + __DYE_BLUE__}`
    }
    case 'object': {
      if (Array.isArray(a)) {
        return `[${a.length}]`
      }
      if (getConstructor(a)) {
        return getConstructor(a).name
      }
      return '{}'
    }
    default: {
      return '*'
    }
  }
}

/** Renders the resolved constructor args for the `new-instance` log line. */
function formatNewInstanceParams(args?: unknown[]): string {
  return (
    args
      ?.map(
        (a) =>
          `${__DYE_DIM__ + __DYE_BOLD__}${formatNewInstanceArg(a)}${__DYE_BOLD_OFF__ + __DYE_DIM__}`,
      )
      .join(', ') || ''
  )
}

/**
 * Renders an `'error'` event. Without `detail` (everything the installed
 * @prostojs/infact@0.4.1 ever produces) the output is exactly the legacy
 * format. With `detail` (newer infact) the D2 consumer context is rendered
 * and, when the failing `@Inject` token is class-provided on a sibling
 * controller of a registered app, the D4 scope hint is appended.
 */
function renderInfactError(
  targetClass: TFunction,
  message: string,
  args?: unknown[],
  detail?: TInfactErrorDetail,
): string {
  if (!detail) {
    const instance = `${__DYE_UNDERSCORE__}${targetClass.name}${__DYE_UNDERSCORE_OFF__}`
    return `Failed to instantiate ${instance}. ${message} ${formatHierarchy(args)}`
  }
  let text = formatInfactErrorContext(targetClass.name, message, detail)
  if (detail.injectToken !== undefined) {
    const hint = formatScopeHint(detail.injectToken, findTokenProviders(detail.injectToken))
    if (hint) {
      text += `\n  ${hint}`
    }
  }
  return text
}

/**
 * Infact event sink. Declared with the forward-compatible 5-param signature:
 * the installed @prostojs/infact (0.4.1) calls it with 4 args (never passes
 * `detail`), while newer infact versions pass a `detail` payload on `'error'`
 * events that unlocks the rich D2/D4 rendering (see `renderInfactError`).
 *
 * Exported for tests — since 0.4.1 never passes `detail` at runtime, the
 * detail-driven path is exercised by invoking this function directly.
 */
// oxlint-disable-next-line max-params -- forward-compatible infact `on` signature (5th arg)
export function onInfactEvent(
  event: TInfactEventName,
  targetClass: TFunction,
  message: string,
  args?: unknown[],
  detail?: TInfactErrorDetail,
) {
  if (!shouldLogInfactEvent(event, targetClass)) {
    return
  }
  let logger
  try {
    // useLogger(topic) derives a child logger via createTopic when supported,
    // falling back to the base logger otherwise
    logger = event === 'error' ? getDefaultLogger(INFACT_BANNER) : useLogger(INFACT_BANNER)
  } catch {
    logger = getDefaultLogger(INFACT_BANNER)
  }
  const instance = `${__DYE_UNDERSCORE__}${targetClass.name}${__DYE_UNDERSCORE_OFF__}`
  if (event === 'new-instance') {
    logger.info(`new ${instance}${__DYE_DIM__ + __DYE_BLUE__}(${formatNewInstanceParams(args)})`)
  } else if (event === 'warn') {
    logger.warn(`${instance} - ${message} ${formatHierarchy(args)}`)
  } else {
    logger.error(renderInfactError(targetClass, message, args, detail))
  }
}

/**
 * Get Infact instance (used for Dependency Injections)
 */
export function getNewMoostInfact() {
  const infactInstance = new Infact<TMoostMetadata, TMoostMetadata, TMoostParamsMetadata, TCustom>({
    describeClass(classConstructor) {
      const meta = getMoostMate().read(classConstructor)
      return {
        injectable: !!meta?.injectable,
        global: false,
        constructorParams: meta?.params || [],
        provide: meta?.provide,
        properties: meta?.properties || [],
        scopeId: meta?.injectable === 'FOR_EVENT' ? useScopeId() : undefined,
      } as unknown as TInfactClassMeta<TMoostParamsMetadata> & TMoostMetadata
    },

    resolveParam({ paramMeta, customData, classConstructor, index, scopeId, instantiate }) {
      if (paramMeta && customData?.pipes) {
        return runPipes(
          customData.pipes,
          undefined,
          {
            paramMeta,
            type: classConstructor,
            key: 'constructor',
            scopeId,
            classMeta: getMoostMate().read(classConstructor),
            index,
            targetMeta: paramMeta,
            instantiate,
          },
          'PARAM',
        )
      }
    },

    describeProp(classConstructor, key) {
      const meta = getMoostMate().read(classConstructor, key)
      return meta as TMoostMetadata
    },

    resolveProp({
      instance,
      key,
      initialValue,
      propMeta,
      scopeId,
      classMeta,
      customData,
      classConstructor,
      instantiate,
    }) {
      if (propMeta && customData?.pipes) {
        return runPipes(
          customData.pipes,
          initialValue,
          {
            instance,
            type: classConstructor,
            key,
            scopeId,
            propMeta,
            targetMeta: propMeta,
            classMeta: classMeta as unknown as TMoostMetadata,
            instantiate,
          },
          'PROP',
        )
      }
    },

    storeProvideRegByInstance: true,

    // @prostojs/infact ≥0.5.0 passes the optional 5th `detail` arg on DI
    // errors; older copies simply never pass it and get the legacy format.
    on: onInfactEvent,
  })
  return infactInstance
}
