import { TInterceptorFn, TInterceptorPriority } from '../decorators/intercept.decorator'
import { Mate } from '@prostojs/mate'
import { TAny, TClassConstructor, TEmpty, TFunction, TObject } from 'common'
import { TProvideRegistry } from '@prostojs/infact'
import { TPipeData, TPipeMetas } from '../pipes'
import { TCallableClassFunction } from '../class-function/types'
import { TValidoDtoOptions, TValidoFn } from '@prostojs/valido'
import { TDecoratorLevel } from '../decorators/types'

const METADATA_WORKSPACE = 'moost'

interface TCommonMetaFields {
    id?: string
    label?: string
    optional?: boolean
    required?: boolean
}

interface TCommonMoostMeta {
    inherit?: boolean
    pipes?: TPipeData[]
    resolver?: (metas: TPipeMetas<TAny>, level: TDecoratorLevel) => unknown
    type?: TFunction
    validators?: TValidoFn<TAny>[]
    validatorsOfItem?: TValidoFn<TAny>[]
    arrayType?: true | TValidateArrayOptions<TAny>
}

export interface TValidateArrayOptions<T = unknown> {
    itemType?: (item: T, index: number) => Promise<TFunction> | TFunction
    itemValidators?: () => (PropertyDecorator | ParameterDecorator)[]
    minLength?: number
    maxLength?: number
}

export type TInjectableScope = 'FOR_EVENT' | 'SINGLETON'
export type TMoostHandler<T extends object> = T & {
    type: string
}

export interface TMoostMetadata extends TCommonMetaFields, TCommonMoostMeta {
    dto?: TValidoDtoOptions
    requiredProps?: (string | symbol)[]
    controller?: {
        prefix?: string
    }
    importController?: {
        prefix?: string
        typeResolver?: TClassConstructor | (() => TClassConstructor | TObject | Promise<TClassConstructor | TObject>)
        provide?: TProvideRegistry
    }[]
    properties?: (string | symbol)[],
    injectable?: true | TInjectableScope
    interceptors?: TInterceptorData[],
    handlers?: TMoostHandler<TAny>[]
    provide?: TProvideRegistry
}

export interface TInterceptorData {
    handler: TCallableClassFunction<TInterceptorFn>
    priority: TInterceptorPriority
}

export interface TMoostParamsMetadata extends TCommonMetaFields, TCommonMoostMeta {
    circular?: () => TAny
    inject?: string | symbol | TClassConstructor
}

const moostMate = new Mate<TMoostMetadata, TMoostMetadata, TMoostMetadata & TMoostParamsMetadata>(METADATA_WORKSPACE, {
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

export function getMoostMate<Class extends TObject = TEmpty, Prop extends TObject = TEmpty, Param extends TObject = TEmpty>() {
    return moostMate as Mate<TMoostMetadata & Class, TMoostMetadata & Prop, TMoostMetadata & TMoostParamsMetadata & Param>
}
