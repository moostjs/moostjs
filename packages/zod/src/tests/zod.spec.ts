import { validate } from '..'
import { ValidoTestClass, ValidoTestClass2, ValidoTestClassArray, ValidoTestClassRefine, ValidoTestClassZod } from './zod.artifacts'

describe('zod', () => {
    it('must validate generic types', async () => {
        expect(await validate({
            name: 'John', age: 23,
        }, ValidoTestClass))
            .toEqual({
                name: 'John', age: 23,
            })
            
        expect(await validate({
            name: 'John', age: 23,
        }, ValidoTestClass2))
            .toEqual({
                name: 'John', age: 23, lastName: '',
            })
            
        expect(await validate({
            name: 'John2', age: 27,
        }, ValidoTestClass2))
            .toEqual({
                name: 'John2', age: 27, lastName: '',
            })
    })

    it('must validate array types', async () => {
        expect(await validate({
            tags: ['t1', 't2'],
            tuple: ['123', 321, false],
            children: [{ name: 'John', age: 23 }, { name: 'Jason', age: 15 }],
        }, ValidoTestClassArray))
            .toEqual({
                tags: ['t1', 't2'],
                tuple: ['123', 321, false],
                children: [{ name: 'John', age: 23, lastName: '' }, { name: 'Jason', age: 15, lastName: '' }],
            })
        expect(await validate({
            tags: ['t1', 33],
            tuple: ['123', '321', false],
            children: [{ name: 'John', age: 23 }, { name: 55, age: 15 }],
        }, ValidoTestClassArray, undefined, true))
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
        }, ValidoTestClassZod))
            .toEqual({
                email: 'abcd@mail.com',
                age: 16,
            })
        expect(await validate({
            email: 'abcdmail.com',
            age: 15,
        }, ValidoTestClassZod, undefined, true))
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
        expect(await validate({ myString: 'test string' }, ValidoTestClassRefine)).toEqual({ myString: 'test string' })
        expect(await validate({ myString: 'test string long string longer thatn 50 characters!!!' }, ValidoTestClassRefine, undefined, true)).toMatchInlineSnapshot(`
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
})

