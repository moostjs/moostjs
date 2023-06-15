import {
    TInterceptorFn,
    TInterceptorPriority,
} from '../decorators/intercept.decorator'
import { Mate, TMateParamMeta } from '@prostojs/mate'
import { TAny, TClassConstructor, TEmpty, TFunction, TObject } from 'common'
import { TProvideRegistry } from '@prostojs/infact'
import { TPipeData, TPipeMetas } from '../pipes'
import { TCallableClassFunction } from '../class-function/types'
import { TDecoratorLevel } from '../decorators/types'

const METADATA_WORKSPACE = 'moost'

export interface TMoostMetadata<H extends TObject = TEmpty> extends TCommonMetaFields, TCommonMoostMeta {
    requiredProps?: (string | symbol)[]
    controller?: {
        prefix?: string
    }
    importController?: {
        prefix?: string
        typeResolver?:
        | TClassConstructor
        | (() =>
            | TClassConstructor
            | TObject
            | Promise<TClassConstructor | TObject>)
        provide?: TProvideRegistry
    }[]
    properties?: (string | symbol)[]
    injectable?: true | TInjectableScope
    interceptors?: TInterceptorData[]
    handlers?: TMoostHandler<H>[]
    provide?: TProvideRegistry
    params: (TMateParamMeta & TMoostParamsMetadata)[]
}

export interface TMoostParamsMetadata extends TCommonMetaFields, TCommonMoostMeta {
    circular?: () => TAny
    inject?: string | symbol | TClassConstructor
    nullable?: boolean
    paramSource?: string
    paramName?: string
}

export type TInjectableScope = 'FOR_EVENT' | 'SINGLETON'
export type TMoostHandler<T> = {
    type: string
    path?: string
} & T

export interface TInterceptorData {
    handler: TCallableClassFunction<TInterceptorFn>
    priority: TInterceptorPriority
}

const moostMate = new Mate<
    TMoostMetadata,
    TMoostMetadata
>(METADATA_WORKSPACE, {
    readType: true,
    readReturnType: true,
    collectPropKeys: true,
    inherit(classMeta, targetMeta, level) {
        if (level === 'CLASS') {
            return !!classMeta?.inherit
        }
        if (level === 'PROP') {
            return (
                !!targetMeta?.inherit || !!(classMeta?.inherit && !targetMeta)
            )
        }
        return !!targetMeta?.inherit
    },
})

export function getMoostMate<
    Class extends TObject = TEmpty,
    Prop extends TObject = TEmpty,
    Param extends TObject = TEmpty
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
