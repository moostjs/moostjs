import { validate } from '../validate'
import { ValidoDecoratorsTestClass } from './decoratros.artifacts'

describe('zod with decorators', () => {
    it('should pass validation for valid data', async () => {
        const data = {
            name: 'John',
            age: 25,
            tags: ['tag1', 'tag2', 123, 456],
            role: 'admin',
            role2: 'user',
            upperName: ' upper and trimmed ',
            catchExample: 'catch',
            fixedLengthString: 'fixed',
            limitedNumber: 50,
            fromDate: new Date(2010, 0, 1),
            toDate: new Date(2022, 0, 1),
            nullableValue: null,
            nullishValue: undefined,
            email: 'test@example.com',
            url: 'https://example.com',
            emoji: '😀',
            uuid: '123e4567-e89b-12d3-a456-426655440000',
            cuid: 'cjb6mdsb90000qw42x6f7xd4r',
            cuid2: 'ckfgagrk70000z6b9gkz5kblv',
            ulid: '01FAEMFCNH0WJD3V4W5Z2N1JKK',
            datetime: '2022-01-01T00:00:00.000Z',
            ip: '127.0.0.1',
            uppercase: 'ABC',
            startsWithHello: 'HelloWorld',
            endsWithWorld: 'HelloWorld',
            greaterThanTen: 20,
            greaterThanOrEqualToTwenty: 30,
            lessThanThirty: 20,
            lessThanOrEqualToForty: 40,
            integer: 10,
            positiveNumber: 5,
            nonNegativeNumber: 0,
            negativeNumber: -5,
            nonPositiveNumber: -10,
            multipleOfFive: 15,
            finiteNumber: 123.45,
            safeNumber: 987.65,
            includesWorld: 'Hello world',
            stringType: 'string',
            numberType: 123,
            bigintType: BigInt(123),
            booleanType: true,
            dateType: new Date(),
            symbolType: Symbol('symbol'),
            undefinedType: undefined,
            nullType: null,
            voidType: undefined,
            anyType: 'any',
            unknownType: 'unknown',
            // neverType: 'never',
            enumType: 'A',
            nativeEnumType: 'RED',
            setType: new Set(['value1', 'value2']),
            mapType: new Map([['key1', 1], ['key2', 2]]),
            literalType: 'literal',
            nanType: NaN,
            recordType: { key1: 1, key2: 2 },
            unionType: 'string',
            discriminatedUnionType: { type: 'A', value: 'string' },
            intersectionType: { prop1: 'string', prop2: 123 },
            promiseType: Promise.resolve('promise'),
            preprocessedType: true,
            customType: 'custom',
            andType: { prop1: 'str', prop2: 123 },
            orType: { prop2: 123 },
        }

        const result = await validate(data, ValidoDecoratorsTestClass, undefined, true)
        if (!result.success) {
            console.log(result.error)
        }
        expect(result.success).toBe(true)
        if (result.success) {
            data.upperName = 'UPPER AND TRIMMED'
            data.tags = ['tag1', 'tag2', '123', '456']
            data.preprocessedType = 'true' as unknown as boolean
            expect(result.data).toEqual(data)
        }
    })

    it('should fail validation for invalid data', async () => {
        const data = {
            name: 'John',
            age: '25', // Invalid type
            tags: 'tag1', // Invalid type
            role: 'guest', // Invalid value
            role2: 'admin', // Invalid value
            upperName: 123, // Invalid type
            catchExample: 123, // Invalid type
            fixedLengthString: 'short', // Invalid length
            limitedNumber: 150, // Exceeds maximum
            fromDate: '2022-01-01', // Invalid type
            toDate: '2022-12-31', // Invalid type
            nullableValue: undefined, // Invalid type
            nullishValue: false, // Invalid type
            email: 'test@example', // Invalid format
            url: 'example.com', // Invalid format
            emoji: 'invalid', // Invalid format
            uuid: '123', // Invalid format
            cuid: 'invalid', // Invalid format
            cuid2: 'invalid', // Invalid format
            ulid: 'invalid', // Invalid format
            datetime: '2022-01-01', // Invalid format
            ip: 'localhost', // Invalid format
            uppercase: 'abc', // Invalid format
            startsWithHello: 'World', // Does not start with "Hello"
            endsWithWorld: 'Hello', // Does not end with "World"
            greaterThanTen: 5, // Less than minimum
            greaterThanOrEqualToTwenty: 15, // Less than minimum
            lessThanThirty: 40, // Greater than maximum
            lessThanOrEqualToForty: 50, // Greater than maximum
            integer: 10.5, // Not an integer
            positiveNumber: -5, // Not a positive number
            nonNegativeNumber: -1, // Not a non-negative number
            negativeNumber: 0, // Not a negative number
            nonPositiveNumber: 5, // Not a non-positive number
            multipleOfFive: 12, // Not a multiple of 5
            finiteNumber: Infinity, // Not a finite number
            safeNumber: 'safe', // Invalid type
            includesWorld: 'Hello', // Does not include "world"
            stringType: 123, // Invalid type
            numberType: '123', // Invalid type
            bigintType: '123', // Invalid type
            booleanType: 'true', // Invalid type
            dateType: '2022-01-01', // Invalid type
            symbolType: 'symbol', // Invalid type
            undefinedType: null, // Invalid type
            nullType: undefined, // Invalid type
            voidType: null, // Invalid type
            anyType: 123, // Invalid type
            unknownType: 123, // Invalid type
            neverType: 'never', // Invalid type
            enumType: 'D', // Invalid value
            nativeEnumType: 'Yellow', // Invalid value
            setType: ['value1', 'value2'], // Invalid type
            mapType: { key1: 'value1', key2: 'value2' }, // Invalid type
            literalType: 'value', // Invalid value
            nanType: 'NaN', // Invalid type
            recordType: { key1: 'value1', key2: 'value2' }, // Invalid type
            unionType: true, // Invalid type
            discriminatedUnionType: { type: 'A', value: 123 }, // Invalid type
            intersectionType: { prop1: 123, prop2: 'string' }, // Invalid types
            promiseType: 'promise', // Invalid type
            preprocessedType: 'value', // Invalid value after preprocessing
            customType: 'invalid', // Invalid value
            andType: true, // Invalid type
            orType: false, // Invalid type
        }

        const result = await validate(data, ValidoDecoratorsTestClass, undefined, true)
        expect(result.success).toBe(false)
        if (!result.success) {
            expect(result.error).toMatchInlineSnapshot(`
[ZodError: [
  {
    "code": "invalid_type",
    "expected": "number",
    "received": "string",
    "path": [
      "age"
    ],
    "message": "Expected number, received string"
  },
  {
    "code": "invalid_type",
    "expected": "array",
    "received": "string",
    "path": [
      "tags"
    ],
    "message": "Expected array, received string"
  },
  {
    "code": "invalid_type",
    "expected": "string",
    "received": "number",
    "path": [
      "upperName"
    ],
    "message": "Expected string, received number"
  },
  {
    "code": "too_big",
    "maximum": 100,
    "type": "number",
    "inclusive": true,
    "exact": false,
    "message": "Number must be less than or equal to 100",
    "path": [
      "limitedNumber"
    ]
  },
  {
    "code": "invalid_type",
    "expected": "date",
    "received": "string",
    "path": [
      "fromDate"
    ],
    "message": "Expected date, received string"
  },
  {
    "code": "invalid_type",
    "expected": "date",
    "received": "string",
    "path": [
      "toDate"
    ],
    "message": "Expected date, received string"
  },
  {
    "code": "invalid_type",
    "expected": "string",
    "received": "undefined",
    "path": [
      "nullableValue"
    ],
    "message": "Required"
  },
  {
    "code": "invalid_type",
    "expected": "string",
    "received": "boolean",
    "path": [
      "nullishValue"
    ],
    "message": "Expected string, received boolean"
  },
  {
    "validation": "email",
    "code": "invalid_string",
    "message": "Invalid email",
    "path": [
      "email"
    ]
  },
  {
    "validation": "url",
    "code": "invalid_string",
    "message": "Invalid url",
    "path": [
      "url"
    ]
  },
  {
    "validation": "emoji",
    "code": "invalid_string",
    "message": "Invalid emoji",
    "path": [
      "emoji"
    ]
  },
  {
    "validation": "uuid",
    "code": "invalid_string",
    "message": "Invalid uuid",
    "path": [
      "uuid"
    ]
  },
  {
    "validation": "cuid",
    "code": "invalid_string",
    "message": "Invalid cuid",
    "path": [
      "cuid"
    ]
  },
  {
    "validation": "ulid",
    "code": "invalid_string",
    "message": "Invalid ulid",
    "path": [
      "ulid"
    ]
  },
  {
    "code": "invalid_string",
    "validation": "datetime",
    "message": "Invalid datetime",
    "path": [
      "datetime"
    ]
  },
  {
    "validation": "ip",
    "code": "invalid_string",
    "message": "Invalid ip",
    "path": [
      "ip"
    ]
  },
  {
    "validation": "regex",
    "code": "invalid_string",
    "message": "Invalid",
    "path": [
      "uppercase"
    ]
  },
  {
    "code": "invalid_string",
    "validation": {
      "startsWith": "Hello"
    },
    "message": "Invalid input: must start with \\"Hello\\"",
    "path": [
      "startsWithHello"
    ]
  },
  {
    "code": "invalid_string",
    "validation": {
      "endsWith": "World"
    },
    "message": "Invalid input: must end with \\"World\\"",
    "path": [
      "endsWithWorld"
    ]
  },
  {
    "code": "too_small",
    "minimum": 10,
    "type": "number",
    "inclusive": false,
    "exact": false,
    "message": "Number must be greater than 10",
    "path": [
      "greaterThanTen"
    ]
  },
  {
    "code": "too_small",
    "minimum": 20,
    "type": "number",
    "inclusive": true,
    "exact": false,
    "message": "Number must be greater than or equal to 20",
    "path": [
      "greaterThanOrEqualToTwenty"
    ]
  },
  {
    "code": "too_big",
    "maximum": 30,
    "type": "number",
    "inclusive": false,
    "exact": false,
    "message": "Number must be less than 30",
    "path": [
      "lessThanThirty"
    ]
  },
  {
    "code": "too_big",
    "maximum": 40,
    "type": "number",
    "inclusive": true,
    "exact": false,
    "message": "Number must be less than or equal to 40",
    "path": [
      "lessThanOrEqualToForty"
    ]
  },
  {
    "code": "invalid_type",
    "expected": "integer",
    "received": "float",
    "message": "Expected integer, received float",
    "path": [
      "integer"
    ]
  },
  {
    "code": "too_small",
    "minimum": 0,
    "type": "number",
    "inclusive": false,
    "exact": false,
    "message": "Number must be greater than 0",
    "path": [
      "positiveNumber"
    ]
  },
  {
    "code": "too_small",
    "minimum": 0,
    "type": "number",
    "inclusive": true,
    "exact": false,
    "message": "Number must be greater than or equal to 0",
    "path": [
      "nonNegativeNumber"
    ]
  },
  {
    "code": "too_big",
    "maximum": 0,
    "type": "number",
    "inclusive": false,
    "exact": false,
    "message": "Number must be less than 0",
    "path": [
      "negativeNumber"
    ]
  },
  {
    "code": "too_big",
    "maximum": 0,
    "type": "number",
    "inclusive": true,
    "exact": false,
    "message": "Number must be less than or equal to 0",
    "path": [
      "nonPositiveNumber"
    ]
  },
  {
    "code": "not_multiple_of",
    "multipleOf": 5,
    "message": "Number must be a multiple of 5",
    "path": [
      "multipleOfFive"
    ]
  },
  {
    "code": "not_finite",
    "message": "Number must be finite",
    "path": [
      "finiteNumber"
    ]
  },
  {
    "code": "invalid_type",
    "expected": "number",
    "received": "string",
    "path": [
      "safeNumber"
    ],
    "message": "Expected number, received string"
  },
  {
    "code": "invalid_string",
    "validation": {
      "includes": "world"
    },
    "message": "Invalid input: must include \\"world\\"",
    "path": [
      "includesWorld"
    ]
  },
  {
    "code": "invalid_type",
    "expected": "string",
    "received": "number",
    "path": [
      "stringType"
    ],
    "message": "Expected string, received number"
  },
  {
    "code": "invalid_type",
    "expected": "number",
    "received": "string",
    "path": [
      "numberType"
    ],
    "message": "Expected number, received string"
  },
  {
    "code": "invalid_type",
    "expected": "bigint",
    "received": "string",
    "path": [
      "bigintType"
    ],
    "message": "Expected bigint, received string"
  },
  {
    "code": "invalid_type",
    "expected": "boolean",
    "received": "string",
    "path": [
      "booleanType"
    ],
    "message": "Expected boolean, received string"
  },
  {
    "code": "invalid_type",
    "expected": "date",
    "received": "string",
    "path": [
      "dateType"
    ],
    "message": "Expected date, received string"
  },
  {
    "code": "invalid_type",
    "expected": "symbol",
    "received": "string",
    "path": [
      "symbolType"
    ],
    "message": "Expected symbol, received string"
  },
  {
    "code": "invalid_type",
    "expected": "undefined",
    "received": "null",
    "path": [
      "undefinedType"
    ],
    "message": "Expected undefined, received null"
  },
  {
    "code": "invalid_type",
    "expected": "null",
    "received": "undefined",
    "path": [
      "nullType"
    ],
    "message": "Required"
  },
  {
    "code": "invalid_type",
    "expected": "void",
    "received": "null",
    "path": [
      "voidType"
    ],
    "message": "Expected void, received null"
  },
  {
    "received": "D",
    "code": "invalid_enum_value",
    "options": [
      "A",
      "B",
      "C"
    ],
    "path": [
      "enumType"
    ],
    "message": "Invalid enum value. Expected 'A' | 'B' | 'C', received 'D'"
  },
  {
    "received": "Yellow",
    "code": "invalid_enum_value",
    "options": [
      "RED",
      "GREEN",
      "BLUE"
    ],
    "path": [
      "nativeEnumType"
    ],
    "message": "Invalid enum value. Expected 'RED' | 'GREEN' | 'BLUE', received 'Yellow'"
  },
  {
    "code": "invalid_type",
    "expected": "set",
    "received": "array",
    "path": [
      "setType"
    ],
    "message": "Expected set, received array"
  },
  {
    "code": "invalid_type",
    "expected": "map",
    "received": "object",
    "path": [
      "mapType"
    ],
    "message": "Expected map, received object"
  },
  {
    "received": "value",
    "code": "invalid_literal",
    "expected": "literal",
    "path": [
      "literalType"
    ],
    "message": "Invalid literal value, expected \\"literal\\""
  },
  {
    "code": "invalid_type",
    "expected": "nan",
    "received": "string",
    "path": [
      "nanType"
    ],
    "message": "Expected nan, received string"
  },
  {
    "code": "invalid_type",
    "expected": "number",
    "received": "string",
    "path": [
      "recordType",
      "key1"
    ],
    "message": "Expected number, received string"
  },
  {
    "code": "invalid_type",
    "expected": "number",
    "received": "string",
    "path": [
      "recordType",
      "key2"
    ],
    "message": "Expected number, received string"
  },
  {
    "code": "invalid_type",
    "expected": "string",
    "received": "number",
    "path": [
      "discriminatedUnionType",
      "value"
    ],
    "message": "Expected string, received number"
  },
  {
    "code": "invalid_type",
    "expected": "string",
    "received": "number",
    "path": [
      "intersectionType",
      "prop1"
    ],
    "message": "Expected string, received number"
  },
  {
    "code": "invalid_type",
    "expected": "number",
    "received": "string",
    "path": [
      "intersectionType",
      "prop2"
    ],
    "message": "Expected number, received string"
  },
  {
    "code": "invalid_type",
    "expected": "object",
    "received": "boolean",
    "path": [
      "andType"
    ],
    "message": "Expected object, received boolean"
  },
  {
    "code": "invalid_type",
    "expected": "object",
    "received": "boolean",
    "path": [
      "andType"
    ],
    "message": "Expected object, received boolean"
  },
  {
    "code": "unrecognized_keys",
    "keys": [
      "neverType"
    ],
    "path": [],
    "message": "Unrecognized key(s) in object: 'neverType'"
  },
  {
    "code": "custom",
    "message": "Invalid input",
    "path": [
      "role"
    ]
  },
  {
    "code": "custom",
    "fatal": true,
    "path": [
      "customType"
    ],
    "message": "Invalid input"
  },
  {
    "code": "invalid_union",
    "unionErrors": [
      {
        "issues": [
          {
            "code": "invalid_type",
            "expected": "string",
            "received": "boolean",
            "path": [
              "unionType"
            ],
            "message": "Expected string, received boolean"
          }
        ],
        "name": "ZodError"
      },
      {
        "issues": [
          {
            "code": "invalid_type",
            "expected": "number",
            "received": "boolean",
            "path": [
              "unionType"
            ],
            "message": "Expected number, received boolean"
          }
        ],
        "name": "ZodError"
      }
    ],
    "path": [
      "unionType"
    ],
    "message": "Invalid input"
  },
  {
    "code": "invalid_union",
    "unionErrors": [
      {
        "issues": [
          {
            "code": "invalid_type",
            "expected": "object",
            "received": "boolean",
            "path": [
              "orType"
            ],
            "message": "Expected object, received boolean"
          }
        ],
        "name": "ZodError"
      },
      {
        "issues": [
          {
            "code": "invalid_type",
            "expected": "object",
            "received": "boolean",
            "path": [
              "orType"
            ],
            "message": "Expected object, received boolean"
          }
        ],
        "name": "ZodError"
      }
    ],
    "path": [
      "orType"
    ],
    "message": "Invalid input"
  }
]]
`)
        }
    })
})
