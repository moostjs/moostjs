import { TInterceptorFn, TInterceptorPriority } from '../decorators/intercept.decorator'
import { Mate, TProstoParamsMetadata, TProstoMetadata } from '@prostojs/mate'
import { TAny, TClassConstructor, TFunction, TObject } from 'common'
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
    pipes?: TPipeData[]
    resolver?: (metas: TPipeMetas, level: TDecoratorLevel) => unknown
}

type TProstoParamsAndCommonMetadata = TProstoParamsMetadata & TCommonMetaFields & TCommonMoostMeta
type TProstoAndCommonMetadata<T extends TMoostParamsMetadata = TMoostParamsMetadata> = TProstoMetadata<T> & TCommonMetaFields & TCommonMoostMeta

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
    properties?: (string | symbol)[],
    injectable?: true | TInjectableScope
    interceptors?: TInterceptorData[],
    handlers?: TMoostHandler<TAny>[]
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
    circular?: () => TAny
    inject?: string | symbol
}

const moostMate = new Mate<TMoostMetadata>(METADATA_WORKSPACE, {
    readType: true,
    readReturnType: true,
    collectPropKeys: true,
})

export function getMoostMate() {
    return moostMate
}
