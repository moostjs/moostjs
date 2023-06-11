import { validate } from '../validate'
import { PrimitivesTestClass } from './primitives.artifacts'

describe('zod with PrimitivesTestClass', () => {
    it('should pass validation for valid data', async () => {
        const data = {
            propString: 'example',
            propNumber: 1,
            propBigint: BigInt(2),
            propBoolean: true,
            propDate: new Date(),
            propSymbol: Symbol('1'),
            propUndefined: undefined,
            propNull: null,
            propUnknown: 'unknown',
        }

        const result = await validate(data, PrimitivesTestClass, undefined, true)
        if (!result.success) {
            console.log(result.error)
        }
        expect(result.success).toBe(true)
        if (result.success) {
            expect(result.data).toEqual(data)
        }
    })

    it('should fail validation for invalid data', async () => {
        const data = {
            propString: 123, // Invalid type
            propNumber: 'not a number', // Invalid type
            propBigint: '2', // Invalid type
            propBoolean: 'true', // Invalid type
            propDate: new Date().toISOString(), // Invalid type
            propSymbol: 'symbol', // Invalid type
            propUndefined: 'undefined', // Invalid type
            propNull: 'null', // Invalid type
        }

        const result = await validate(data, PrimitivesTestClass, undefined, true)
        expect(result.success).toBe(false)
        if (!result.success) {
            expect(result.error).toMatchInlineSnapshot(`
[ZodError: [
  {
    "code": "invalid_type",
    "expected": "string",
    "received": "number",
    "path": [
      "propString"
    ],
    "message": "Expected string, received number"
  },
  {
    "code": "invalid_type",
    "expected": "number",
    "received": "string",
    "path": [
      "propNumber"
    ],
    "message": "Expected number, received string"
  },
  {
    "code": "invalid_type",
    "expected": "bigint",
    "received": "string",
    "path": [
      "propBigint"
    ],
    "message": "Expected bigint, received string"
  },
  {
    "code": "invalid_type",
    "expected": "boolean",
    "received": "string",
    "path": [
      "propBoolean"
    ],
    "message": "Expected boolean, received string"
  },
  {
    "code": "invalid_type",
    "expected": "date",
    "received": "string",
    "path": [
      "propDate"
    ],
    "message": "Expected date, received string"
  },
  {
    "code": "invalid_type",
    "expected": "symbol",
    "received": "string",
    "path": [
      "propSymbol"
    ],
    "message": "Expected symbol, received string"
  },
  {
    "code": "invalid_type",
    "expected": "undefined",
    "received": "string",
    "path": [
      "propUndefined"
    ],
    "message": "Expected undefined, received string"
  },
  {
    "code": "invalid_type",
    "expected": "null",
    "received": "string",
    "path": [
      "propNull"
    ],
    "message": "Expected null, received string"
  }
]]
`)
        }
    })
})
