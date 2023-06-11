// deno-lint-ignore-file
import { IsArray, Refine, Zod } from '../zod.decorators'
import { getZodMate } from '../zod.mate'
import { z } from 'zod'

const mate = getZodMate()

export class ValidoTestClass {
    name: string = ''

    age: number = 0
}

@mate.decorate('inherit', true)
export class ValidoTestClass2 extends ValidoTestClass {
    @mate.decorate('optional', true)
    @mate.decorate('default', '')
    lastName?: string = ''
}

export class ValidoTestClassArray {
    @IsArray(() => ValidoTestClass2)
    children: ValidoTestClass2[] = []

    @IsArray(() => String)
    tags: string[] = []

    @IsArray(() => [String, Number, Boolean])
    tuple: [string, number, boolean] = ['1', 1, true]
}

export class ValidoTestClassZod {
    @Zod(z.string().email())
    email = ''

    @Zod(z.number().min(16))
    age = 0
}

export class ValidoTestClassRefine {
    @Refine((val) => val.length <= 50, {
        message: 'String can\'t be more than 50 characters',
    })
    myString = ''
}

// Using the Zod decorator
export class SingleZod {
    @Zod(z.string())
    value = ''
}
