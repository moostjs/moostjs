import type { TProvideRegistry, TReplaceRegistry } from '@prostojs/infact'
import type { TMateParamMeta } from '@prostojs/mate'
import { Mate } from '@prostojs/mate'

import type { TAny, TClassConstructor, TEmpty, TFunction, TObject } from '../common-types'
import type {
  TInterceptorDef,
  TInterceptorPriority,
} from '../decorators/intercept.decorator'
import type { TDecoratorLevel } from '../decorators/types'
import type { TPipeData, TPipeMetas } from '../pipes'

const METADATA_WORKSPACE = 'moost'

/** Core metadata shape attached to classes, methods, and properties by Moost decorators. */
export interface TMoostMetadata<H extends TObject = TEmpty>
  extends TCommonMetaFields, TCommonMoostMeta {
  requiredProps?: (string | symbol)[]
  controller?: {
    prefix?: string
  }
  importController?: {
    prefix?: string
    typeResolver?:
      | TClassConstructor
      | (() => TClassConstructor | TObject | Promise<TClassConstructor | TObject>)
    provide?: TProvideRegistry
  }[]
  properties?: (string | symbol)[]
  injectable?: true | TInjectableScope
  interceptor?: { priority: TInterceptorPriority }
  interceptorHook?: 'before' | 'after' | 'error'
  interceptors?: TInterceptorData[]
  handlers?: TMoostHandler<H>[]
  returnType?: TFunction
  provide?: TProvideRegistry
  replace?: TReplaceRegistry
  loggerTopic?: string
  params: (TMateParamMeta & TMoostParamsMetadata)[]
}

/** Metadata attached to constructor/method parameters by Moost decorators. */
export interface TMoostParamsMetadata extends TCommonMetaFields, TCommonMoostMeta {
  circular?: () => TAny
  inject?: string | symbol | TClassConstructor
  nullable?: boolean
  paramSource?: string
  paramName?: string
  fromScope?: string | symbol // for infact scope
}

/** DI scope for injectable classes: per-event or application-wide singleton. */
export type TInjectableScope = 'FOR_EVENT' | 'SINGLETON'

/** Describes a registered handler (HTTP route, CLI command, workflow step, etc.). */
export type TMoostHandler<T> = {
  type: string
  path?: string
} & T

/** Stored interceptor entry attached to a class or method via `@Intercept`. */
export interface TInterceptorData {
  handler: TClassConstructor | TInterceptorDef
  priority: TInterceptorPriority
  name: string
}

const moostMate = new Mate<TMoostMetadata, TMoostMetadata>(METADATA_WORKSPACE, {
  readType: true,
  readReturnType: true,
  collectPropKeys: true,
  inherit(classMeta, targetMeta, level) {
    if (level === 'CLASS') {
      return !!classMeta?.inherit
    }
    if (level === 'PROP') {
      return !!targetMeta?.inherit || !!(classMeta?.inherit && !targetMeta)
    }
    return !!targetMeta?.inherit
  },
})

/** Returns the shared `Mate` instance operating in the `'moost'` metadata workspace. */
export function getMoostMate<
  Class extends TObject = TEmpty,
  Prop extends TObject = TEmpty,
  Param extends TObject = TEmpty,
>() {
  return moostMate as unknown as Mate<
    TMoostMetadata & Class & { params: (Param & TMateParamMeta)[] },
    TMoostMetadata & Prop & { params: (Param & TMateParamMeta)[] }
  >
}

interface TCommonMetaFields {
  id?: string
  label?: string
  value?: unknown
  description?: string
  optional?: boolean
  required?: boolean
}

interface TCommonMoostMeta {
  inherit?: boolean
  pipes?: TPipeData[]
  resolver?: (metas: TPipeMetas<TAny>, level: TDecoratorLevel) => unknown
  type?: TFunction
}
