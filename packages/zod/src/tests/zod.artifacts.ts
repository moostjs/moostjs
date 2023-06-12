// deno-lint-ignore-file
import { Coerce, IsArray, IsTuple, Refine, Zod, IsString } from '../zod.decorators'
import { getZodMate } from '../zod.mate'
import { z } from 'zod'

const mate = getZodMate()

export class ZodTestClass {
    name: string = ''

    age: number = 0
}

@mate.decorate('inherit', true)
export class ZodTestClass2 extends ZodTestClass {
    @mate.decorate('optional', true)
    @mate.decorate('default', '')
    lastName?: string = ''
}

export class ZodTestClassArray {
    @IsArray(ZodTestClass2)
    children: ZodTestClass2[] = []

    @IsArray(String)
    tags: string[] = []

    @IsTuple([String, Number, Boolean])
    tuple: [string, number, boolean] = ['1', 1, true]
}

export class ZodTestClassZod {
    @Zod(z.string().email())
    email = ''

    @Zod(z.number().min(16))
    age = 0
}

export class ZodTestClassRefine {
    @Refine((val) => val.length <= 50, {
        message: 'String can\'t be more than 50 characters',
    })
    myString = ''
}

// export class ZodTestClassCoerce {
//     @Coerce()
//     primitive = ''

//     @Coerce()
//     typed: string = ''

//     @IsString()
//     @Coerce()
//     decorated: string = ''

//     @Coerce()
//     @IsArray()
//     primitiveArray = ['']

//     @Coerce()
//     // @IsArray()
//     typedArray: string[] = ['']

//     @IsString()
//     @Coerce()
//     // @IsArray()
//     decoratedArray: string[] = ['']
// }
export class ZodTestClassCoercePrimitive {
    @Coerce()
    primitive = ''
}

export class ZodTestClassCoerceTyped {
    @Coerce()
    typed: string = ''
}

export class ZodTestClassCoerceDecorated {
    @IsString()
    @Coerce()
    decorated: string = ''
}

export class ZodTestClassCoercePrimitiveArray {
    @Coerce()
    primitiveArray = ['']
}

export class ZodTestClassCoerceTypedArray {
    @Coerce()
    @IsArray()
    typedArray: string[] = ['']
}

export class ZodTestClassCoerceDecoratedArray {
    @IsString()
    @IsArray()
    @Coerce()
    decoratedArray: string[] = []
}

export class ZodTestClassStringArray {
    @IsString()
    a!: string[]
}
