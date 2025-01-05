/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import type { TProvideRegistry, TReplaceRegistry } from '@prostojs/infact'
import type { TMateParamMeta } from '@prostojs/mate'
import { Mate } from '@prostojs/mate'
import type { TAny, TClassConstructor, TEmpty, TFunction, TObject } from 'common'

import type { TCallableClassFunction } from '../class-function/types'
import type { TInterceptorFn, TInterceptorPriority } from '../decorators/intercept.decorator'
import type { TDecoratorLevel } from '../decorators/types'
import type { TPipeData, TPipeMetas } from '../pipes'

const METADATA_WORKSPACE = 'moost'

export interface TMoostMetadata<H extends TObject = TEmpty>
  extends TCommonMetaFields,
    TCommonMoostMeta {
  requiredProps?: Array<string | symbol>
  controller?: {
    prefix?: string
  }
  importController?: Array<{
    prefix?: string
    typeResolver?:
      | TClassConstructor
      | (() => TClassConstructor | TObject | Promise<TClassConstructor | TObject>)
    provide?: TProvideRegistry
  }>
  properties?: Array<string | symbol>
  injectable?: true | TInjectableScope
  interceptors?: TInterceptorData[]
  handlers?: Array<TMoostHandler<H>>
  returnType?: TFunction
  provide?: TProvideRegistry
  replace?: TReplaceRegistry
  loggerTopic?: string
  params: Array<TMateParamMeta & TMoostParamsMetadata>
}

export interface TMoostParamsMetadata extends TCommonMetaFields, TCommonMoostMeta {
  circular?: () => TAny
  inject?: string | symbol | TClassConstructor
  nullable?: boolean
  paramSource?: string
  paramName?: string
  fromScope?: string | symbol // for infact scope
}

export type TInjectableScope = 'FOR_EVENT' | 'SINGLETON'
export type TMoostHandler<T> = {
  type: string
  path?: string
} & T

export interface TInterceptorData {
  handler: TCallableClassFunction<TInterceptorFn>
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

export function getMoostMate<
  Class extends TObject = TEmpty,
  Prop extends TObject = TEmpty,
  Param extends TObject = TEmpty,
>() {
  return moostMate as unknown as Mate<
    TMoostMetadata & Class & { params: Array<Param & TMateParamMeta> },
    TMoostMetadata & Prop & { params: Array<Param & TMateParamMeta> }
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
