// deno-lint-ignore-file
import { Optional } from 'moost'
import { z } from 'zod'

import { Coerce, Default, IsArray, IsString, IsTuple, Or, Refine, Zod } from '../zod.decorators'
import { getZodMate } from '../zod.mate'

const mate = getZodMate()

export class ZodTestClass {
  name = ''

  age = 0
}

@mate.decorate('inherit', true)
export class ZodTestClass2 extends ZodTestClass {
  @Optional()
  @Default('')
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
  @Refine(val => val.length <= 50, {
    message: "String can't be more than 50 characters",
  })
  myString = ''
}

export class ZodTestClassCoercePrimitive {
  @Coerce()
  primitive = ''
}

export class ZodTestClassCoerceTyped {
  @Coerce()
  typed = ''
}

export class ZodTestClassCoerceDecorated {
  @IsString()
  @Coerce()
  decorated = ''
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

  @Optional()
  ao?: ZodTestClassCoerceDecoratedArray
}

export class ZodTestClassOptionalArray {
  @IsString()
  @Optional()
  opt1?: string[]

  @IsString()
  @IsArray()
  @Optional()
  opt2?: string[]

  @IsString()
  @IsArray().optional()
  opt22?: string[]

  @IsString()
  @IsArray()
  @IsArray()
  arrayOfArray!: string[][]

  @IsString().optional()
  @IsArray()
  required!: Array<string | undefined>

  @IsString()
  @Or('undefined')
  @IsArray()
  required2!: Array<string | undefined>

  @IsString()
  @Or('undefined')
  required3!: Array<string | undefined>
}
