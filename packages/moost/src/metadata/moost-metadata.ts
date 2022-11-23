import { TInterceptorFn, TInterceptorPriority } from '../decorators/intercept.decorator'
import { Mate, TProstoParamsMetadata, TProstoMetadata } from '@prostojs/mate'
import { TAny, TClassConstructor, TFunction, TObject } from '../types'
import { TProvideRegistry } from '@prostojs/infact'
import { TPipeData } from '../pipes'
import { TCallableClassFunction } from '../class-function/types'
import { TValidoDtoOptions, TValidoFn } from '@prostojs/valido'

const METADATA_WORKSPACE = 'moost'

interface TCommonMetaFields {
    label?: string
    optional?: boolean
    required?: boolean
}

interface TCommonMoostMeta {
    pipes?: TPipeData[]
}

type TProstoParamsAndCommonMetadata = TProstoParamsMetadata & TCommonMetaFields & TCommonMoostMeta
type TProstoAndCommonMetadata<T extends TMoostParamsMetadata = TMoostParamsMetadata> = TProstoMetadata<T> & TCommonMetaFields & TCommonMoostMeta

export interface TValidateArrayOptions<T = unknown> {
    itemType?: (item: T, index: number) => Promise<TFunction> | TFunction
    itemValidators?: () => (PropertyDecorator | ParameterDecorator)[]
    minLength?: number
    maxLength?: number
}

export type TInjectableScope = 'FOR_REQUEST' | 'SINGLETON'

export interface TMoostMetadata extends TProstoAndCommonMetadata {
    inherit?: boolean
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
    injectable?: true | TInjectableScope
    interceptors?: TInterceptorData[],
    httpHandler?: {
        method: '*' | 'GET' | 'PUT' | 'POST' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS'
        path: string
    }[]
    validators?: TValidoFn[]
    validatorsOfItem?: TValidoFn[]
    arrayType?: true | TValidateArrayOptions,
    provide?: TProvideRegistry
}

export interface TInterceptorData {
    handler: TCallableClassFunction<TInterceptorFn>
    priority: TInterceptorPriority
}

export interface TMoostParamsMetadata extends TProstoParamsAndCommonMetadata {
    validators?: TValidoFn[]
    validatorsOfItem?: TValidoFn[]
    arrayType?: true | TValidateArrayOptions
    resolver?: TFunction
    circular?: () => TAny
    inject?: string | symbol
}

const moostMate = new Mate<TMoostMetadata>(METADATA_WORKSPACE, {
    readType: true,
    readReturnType: true,
})

export function getMoostMate() {
    return moostMate
}
