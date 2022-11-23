import { TValidoDtoOptions, TValidoFn, validoIsBoolean, validoIsNumber, validoIsString, validoIsTypeOf } from '@prostojs/valido'
import { getMoostMate, TValidateArrayOptions } from '../metadata/moost-metadata'

export function Dto(dtoOptions: TValidoDtoOptions = {}): ClassDecorator {
    return getMoostMate().decorate('dto', dtoOptions || {})
}

let isArrayItemValidator = false

export function Validate<T = unknown>(validator: TValidoFn<T>): PropertyDecorator & ParameterDecorator {
    return getMoostMate().decorate(isArrayItemValidator ? 'validatorsOfItem' : 'validators', validator, true)
}

export function IsArray<T = unknown>(opts?: TValidateArrayOptions<T>): PropertyDecorator & ParameterDecorator {
    const mate = getMoostMate()
    const decorators = [mate.decorate('arrayType', opts || true)] as (PropertyDecorator | ParameterDecorator)[]
    if (opts?.itemValidators && !isArrayItemValidator) {
        isArrayItemValidator = true
        decorators.push(...opts.itemValidators())
        isArrayItemValidator = false
    } else if (opts?.itemValidators && isArrayItemValidator) {
        throw new Error('IsArray validator is not supported inside of array type')
    }
    const decorator = mate.apply(...decorators)
    return decorator
}

export function IsTypeOf(type: 'string' | 'object' | 'number' | 'boolean', errorText?: string): PropertyDecorator & ParameterDecorator {
    return Validate(validoIsTypeOf(type, errorText))
}

export function IsString(...args: Parameters<typeof validoIsString>): PropertyDecorator & ParameterDecorator {
    return Validate(validoIsString(...args))
}

export function IsNumber(...args: Parameters<typeof validoIsNumber>): PropertyDecorator & ParameterDecorator {
    return Validate(validoIsNumber(...args))
}

export function IsBoolean(...args: Parameters<typeof validoIsBoolean>): PropertyDecorator & ParameterDecorator {
    return Validate(validoIsBoolean(...args))
}
