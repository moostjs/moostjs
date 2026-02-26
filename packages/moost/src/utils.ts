import { getContextInjector } from '@wooksjs/event-core'

import { getInstanceOwnMethods } from './binding/utils'
import type { TAny, TClassConstructor, TObject } from './common-types'
import { setInterceptResult, setOvertake } from './composables'
import type { TInterceptorDef, TInterceptorDefFactory } from './decorators'
import { InterceptorHandler } from './interceptor-handler'
import type { TInterceptorEntry } from './interceptor-handler'
import type { TInterceptorData, TMoostMetadata, TMoostParamsMetadata } from './metadata'
import { getMoostInfact, getMoostMate } from './metadata'
import type { TPipeData } from './pipes'
import { resolveArguments } from './resolve-arguments'
import { isThenable, mergeSorted } from './shared-utils'

const mate = getMoostMate()

const noInterceptors = () => undefined

interface TInterceptorMethods {
  before?: string
  after?: string
  error?: string
}

type TArgsResolver = () => unknown[] | Promise<unknown[]>

function findInterceptorMethods(handler: TClassConstructor): TInterceptorMethods {
  const fakeInstance = Object.create(handler.prototype) as TObject
  const methods = getInstanceOwnMethods(fakeInstance)
  const result: TInterceptorMethods = {}
  for (const method of methods) {
    const methodMeta = mate.read(fakeInstance, method as string)
    const hook = methodMeta?.interceptorHook
    if (hook === 'before' || hook === 'after' || hook === 'error') {
      result[hook] = method as string
    }
  }
  return result
}

function buildMethodResolver(opts: {
  handler: TClassConstructor
  methodName: string
  pipes: TPipeData[]
  classMeta: TMoostMetadata
}): TArgsResolver | undefined {
  const fakeInstance = Object.create(opts.handler.prototype) as TObject
  const methodMeta = mate.read(fakeInstance, opts.methodName) || ({} as TMoostMetadata)
  const argsPipes: { meta: TMoostParamsMetadata; pipes: TPipeData[] }[] = []
  for (const p of methodMeta.params || ([] as TMoostParamsMetadata[])) {
    argsPipes.push({
      meta: p,
      pipes: mergeSorted(opts.pipes, p.pipes),
    })
  }
  if (argsPipes.length === 0) {
    return undefined
  }
  return resolveArguments(argsPipes, {
    classMeta: opts.classMeta,
    methodMeta,
    type: opts.handler,
    key: opts.methodName,
  })
}

function callWithArgs(instance: TObject, methodName: string, resolveArgs: TArgsResolver) {
  const ci = getContextInjector<string>()
  const args = ci ? ci.with('Arguments:resolve', resolveArgs) : resolveArgs()
  if (isThenable(args)) {
    return (args as Promise<unknown[]>).then((a) =>
      (instance[methodName as keyof TObject] as TAny)(...a),
    )
  }
  return (instance[methodName as keyof TObject] as TAny)(...(args as unknown[]))
}

function callMethod(instance: TObject, methodName: string, resolveArgs?: TArgsResolver) {
  if (resolveArgs) {
    return callWithArgs(instance, methodName, resolveArgs)
  }
  return (instance[methodName as keyof TObject] as TAny)()
}

function createClassInterceptorFactory(opts: {
  handler: TClassConstructor
  methods: TInterceptorMethods
  resolvers: Record<string, TArgsResolver | undefined>
  getTargetInstance: () => Promise<TObject> | TObject
  pipes: TPipeData[]
}): TInterceptorDefFactory {
  const infact = getMoostInfact()

  function buildDef(instance: TObject): TInterceptorDef {
    const def: TInterceptorDef = {}

    if (opts.methods.before) {
      const methodName = opts.methods.before
      const resolveArgs = opts.resolvers[methodName]
      if (resolveArgs) {
        def.before = (reply) => {
          setOvertake(reply)
          return callWithArgs(instance, methodName, resolveArgs)
        }
      } else {
        def.before = () => (instance[methodName as keyof TObject] as TAny)()
      }
    }

    if (opts.methods.after) {
      const methodName = opts.methods.after
      const resolveArgs = opts.resolvers[methodName]
      def.after = (response, reply) => {
        setOvertake(reply)
        setInterceptResult(response)
        return callMethod(instance, methodName, resolveArgs)
      }
    }

    if (opts.methods.error) {
      const methodName = opts.methods.error
      const resolveArgs = opts.resolvers[methodName]
      def.error = (error, reply) => {
        setOvertake(reply)
        setInterceptResult(error)
        return callMethod(instance, methodName, resolveArgs)
      }
    }

    return def
  }

  function fromTarget(targetInstance: TObject): TInterceptorDef | Promise<TInterceptorDef> {
    const result = infact.getForInstance(
      targetInstance,
      opts.handler as TClassConstructor<TAny>,
      { customData: { pipes: opts.pipes } },
    )
    if (isThenable(result)) {
      return (result as Promise<TObject>).then(buildDef)
    }
    return buildDef(result as TObject)
  }

  return () => {
    const result = opts.getTargetInstance()
    if (isThenable(result)) {
      return (result as Promise<TObject>).then(fromTarget)
    }
    return fromTarget(result as TObject)
  }
}

export function getIterceptorHandlerFactory(
  interceptors: TInterceptorData[],
  getTargetInstance: () => Promise<TObject> | TObject,
  pipes: TPipeData[],
): () => InterceptorHandler | undefined {
  if (interceptors.length === 0) {
    return noInterceptors
  }

  const precomputedHandlers = interceptors.map<TInterceptorEntry>(({ handler, name }) => {
    const spanName = `Interceptor:${name}`
    if (typeof handler !== 'function') {
      return { handler, name, spanName }
    }

    const interceptorMeta = mate.read(handler)
    if (!interceptorMeta?.interceptor) {
      throw new Error(
        `Invalid interceptor "${name}": must be TInterceptorDef or @Interceptor class`,
      )
    }

    const classMeta = interceptorMeta as TMoostMetadata
    const methods = findInterceptorMethods(handler as TClassConstructor)
    const mergedPipes = mergeSorted(pipes, classMeta.pipes)

    const resolvers: Record<string, TArgsResolver | undefined> = {}
    for (const hook of ['before', 'after', 'error'] as const) {
      const methodName = methods[hook]
      if (methodName) {
        resolvers[methodName] = buildMethodResolver({
          handler: handler as TClassConstructor,
          methodName,
          pipes: mergedPipes,
          classMeta,
        })
      }
    }

    return {
      handler: createClassInterceptorFactory({
        handler: handler as TClassConstructor,
        methods,
        resolvers,
        getTargetInstance,
        pipes: mergedPipes,
      }),
      name,
      spanName,
    }
  })

  return () => new InterceptorHandler(precomputedHandlers)
}
