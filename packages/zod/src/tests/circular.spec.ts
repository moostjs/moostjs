import { validate } from '../validate'
import { CircularTest } from './circular.artifacts'

describe('zod circular', () => {
  it('must validate circular deps', async () => {
    expect(
      await validate(
        { name: 'Jason', child: { name: 'JasonSon', child: { age: '15' } } },
        CircularTest,
        undefined,
        true
      )
    ).toMatchInlineSnapshot(`
{
  "error": [ZodError: [
  {
    "code": "invalid_type",
    "expected": "string",
    "received": "undefined",
    "path": [
      "child",
      "child",
      "name"
    ],
    "message": "Required"
  },
  {
    "code": "unrecognized_keys",
    "keys": [
      "age"
    ],
    "path": [
      "child",
      "child"
    ],
    "message": "Unrecognized key(s) in object: 'age'"
  }
]],
  "success": false,
}
`)
  })
})
