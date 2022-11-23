/* eslint-disable @typescript-eslint/no-unused-vars */
import { Dto, IsArray, IsBoolean, IsNumber, IsString, IsTypeOf, Validate } from '../validate.decorator'

@Dto()
export class ValidateDecoratorTestClass {
    @Validate(({ value }) => value === 'value' || 'expected value' )
    prop: string = ''
}

@Dto()
export class ValidateDecoratorTestIsTypeOfClass {
    @IsTypeOf('string')
    prop: string = ''
}

@Dto()
export class ValidateDecoratorTestStringClass {
    @IsString({
        minLength: 4,
        maxLength: 10,
        regex: /^[a-z]*$/,
    })
    prop: string = ''
}

@Dto()
export class ValidateDecoratorTestNumberClass {
    @IsNumber({
        min: 4,
        max: 10,
        int: true,
    })
    prop: number = 0
}

@Dto()
export class ValidateDecoratorTestBooleanClass {
    @IsBoolean()
    prop: boolean = false
}

@Dto()
export class ValidateDecoratorTestArrayClass {
    @IsArray({
        minLength: 2,
        maxLength: 4,
    })
    prop: string[] = []

    @IsArray({
        itemValidators: () => [ IsString() ],
    })
    propStr: string[] = []

    @IsArray({
        itemType: (_item, index) => index === 0 ? ValidateDecoratorTestNumberClass : ValidateDecoratorTestBooleanClass,
    })
    propTuple: [ValidateDecoratorTestNumberClass, ValidateDecoratorTestBooleanClass] = [new ValidateDecoratorTestNumberClass(), new ValidateDecoratorTestBooleanClass()]
}
