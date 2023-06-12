import { validate } from '../validate'
import { ZodTestClass, ZodTestClass2, ZodTestClassArray, ZodTestClassCoerceDecorated, ZodTestClassCoerceDecoratedArray, ZodTestClassCoercePrimitive, ZodTestClassCoercePrimitiveArray, ZodTestClassCoerceTyped, ZodTestClassCoerceTypedArray, ZodTestClassRefine, ZodTestClassStringArray, ZodTestClassZod } from './zod.artifacts'

describe('zod', () => {
    it('must validate generic types', async () => {
        expect(await validate({
            name: 'John', age: 23,
        }, ZodTestClass))
            .toEqual({
                name: 'John', age: 23,
            })

        expect(await validate({
            name: 'John', age: 23,
        }, ZodTestClass2))
            .toEqual({
                name: 'John', age: 23, lastName: '',
            })

        expect(await validate({
            name: 'John2', age: 27,
        }, ZodTestClass2))
            .toEqual({
                name: 'John2', age: 27, lastName: '',
            })
    })

    it('must validate array types', async () => {
        expect(await validate({
            tags: ['t1', 't2'],
            tuple: ['123', 321, false],
            children: [{ name: 'John', age: 23 }, { name: 'Jason', age: 15 }],
        }, ZodTestClassArray))
            .toEqual({
                tags: ['t1', 't2'],
                tuple: ['123', 321, false],
                children: [{ name: 'John', age: 23, lastName: '' }, { name: 'Jason', age: 15, lastName: '' }],
            })
        expect(await validate({
            tags: ['t1', 33],
            tuple: ['123', '321', false],
            children: [{ name: 'John', age: 23 }, { name: 55, age: 15 }],
        }, ZodTestClassArray, undefined, true))
            .toMatchInlineSnapshot(`
{
  "error": [ZodError: [
  {
    "code": "invalid_type",
    "expected": "string",
    "received": "number",
    "path": [
      "children",
      1,
      "name"
    ],
    "message": "Expected string, received number"
  },
  {
    "code": "invalid_type",
    "expected": "string",
    "received": "number",
    "path": [
      "tags",
      1
    ],
    "message": "Expected string, received number"
  },
  {
    "code": "invalid_type",
    "expected": "number",
    "received": "string",
    "path": [
      "tuple",
      1
    ],
    "message": "Expected number, received string"
  }
]],
  "success": false,
}
`)
    })

    it('must validate native zod types', async () => {
        expect(await validate({
            email: 'abcd@mail.com',
            age: 16,
        }, ZodTestClassZod))
            .toEqual({
                email: 'abcd@mail.com',
                age: 16,
            })
        expect(await validate({
            email: 'abcdmail.com',
            age: 15,
        }, ZodTestClassZod, undefined, true))
            .toMatchInlineSnapshot(`
{
  "error": [ZodError: [
  {
    "validation": "email",
    "code": "invalid_string",
    "message": "Invalid email",
    "path": [
      "email"
    ]
  },
  {
    "code": "too_small",
    "minimum": 16,
    "type": "number",
    "inclusive": true,
    "exact": false,
    "message": "Number must be greater than or equal to 16",
    "path": [
      "age"
    ]
  }
]],
  "success": false,
}
`)
    })

    it('must validate with zod refine', async () => {
        expect(await validate({ myString: 'test string' }, ZodTestClassRefine)).toEqual({ myString: 'test string' })
        expect(await validate({ myString: 'test string long string longer thatn 50 characters!!!' }, ZodTestClassRefine, undefined, true)).toMatchInlineSnapshot(`
{
  "error": [ZodError: [
  {
    "code": "custom",
    "message": "String can't be more than 50 characters",
    "path": [
      "myString"
    ]
  }
]],
  "success": false,
}
`)
    })

    it('must apply Coerce decorator for primitive property', async () => {
        expect(await validate({ primitive: 1 }, ZodTestClassCoercePrimitive, undefined, true)).toEqual({
            success: true,
            data: { primitive: '1' },
        })
    })

    it('must apply Coerce decorator for typed property', async () => {
        expect(await validate({ typed: 2 }, ZodTestClassCoerceTyped, undefined, true)).toEqual({
            success: true,
            data: { typed: '2' },
        })
    })

    it('must apply Coerce decorator for decorated property', async () => {
        expect(await validate({ decorated: 3 }, ZodTestClassCoerceDecorated, undefined, true)).toEqual({
            success: true,
            data: { decorated: '3' },
        })
    })

    it('must apply Coerce decorator for primitiveArray property', async () => {
        expect(await validate({ primitiveArray: [1, 5] }, ZodTestClassCoercePrimitiveArray, undefined, true)).toEqual({
            success: true,
            data: { primitiveArray: ['1', '5'] },
        })
    })

    it('must apply Coerce decorator for typedArray property', async () => {
        expect(await validate({ typedArray: [2, 5] }, ZodTestClassCoerceTypedArray, undefined, true)).toEqual({
            success: true,
            data: { typedArray: ['2', '5'] },
        })
    })

    it('must apply Coerce decorator for decoratedArray property', async () => {
        expect(await validate({ decoratedArray: [3, 5] }, ZodTestClassCoerceDecoratedArray, undefined, true)).toEqual({
            success: true,
            data: { decoratedArray: ['3', '5'] },
        })
    })

    it('must figure out that the type is array just by array runtime type', async () => {
        expect(await validate({ a: ['first', 'last'] }, ZodTestClassStringArray, undefined, true)).toEqual({
            success: true,
            data: { a: ['first', 'last'] },
        })
    })
})

