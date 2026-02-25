import { describe, expect, it } from 'vitest'

import { jsonToYaml } from '../json-to-yaml'

describe('jsonToYaml', () => {
  it('should convert primitives', () => {
    expect(jsonToYaml(null)).toBe('null\n')
    expect(jsonToYaml(undefined)).toBe('null\n')
    expect(jsonToYaml(true)).toBe('true\n')
    expect(jsonToYaml(false)).toBe('false\n')
    expect(jsonToYaml(42)).toBe('42\n')
    expect(jsonToYaml(3.14)).toBe('3.14\n')
    expect(jsonToYaml('hello')).toBe('hello\n')
  })

  it('should quote special strings', () => {
    expect(jsonToYaml('true')).toBe('"true"\n')
    expect(jsonToYaml('false')).toBe('"false"\n')
    expect(jsonToYaml('null')).toBe('"null"\n')
    expect(jsonToYaml('')).toBe("''\n")
    expect(jsonToYaml('123')).toBe('"123"\n')
    expect(jsonToYaml('# comment')).toBe('"# comment"\n')
    expect(jsonToYaml('key: value')).toBe('"key: value"\n')
    expect(jsonToYaml('has\nnewline')).toBe('"has\\nnewline"\n')
  })

  it('should convert empty collections', () => {
    expect(jsonToYaml([])).toBe('[]\n')
    expect(jsonToYaml({})).toBe('{}\n')
  })

  it('should convert simple arrays', () => {
    expect(jsonToYaml([1, 2, 3])).toBe('- 1\n- 2\n- 3\n')
    expect(jsonToYaml(['a', 'b'])).toBe('- a\n- b\n')
  })

  it('should convert simple objects', () => {
    expect(jsonToYaml({ name: 'test', version: 1 })).toBe('name: test\nversion: 1\n')
  })

  it('should handle nested objects', () => {
    const input = {
      info: {
        title: 'My API',
        version: '1.0.0',
      },
    }
    expect(jsonToYaml(input)).toBe('info:\n  title: My API\n  version: 1.0.0\n')
  })

  it('should handle arrays of objects', () => {
    const input = {
      tags: [{ name: 'users' }, { name: 'posts' }],
    }
    expect(jsonToYaml(input)).toBe('tags:\n  - name: users\n  - name: posts\n')
  })

  it('should handle deeply nested structures', () => {
    const input = {
      paths: {
        '/users': {
          get: {
            summary: 'List users',
            responses: {
              '200': {
                description: 'OK',
              },
            },
          },
        },
      },
    }
    const expected = [
      'paths:',
      '  /users:',
      '    get:',
      '      summary: List users',
      '      responses:',
      '        "200":',
      '          description: OK',
      '',
    ].join('\n')
    expect(jsonToYaml(input)).toBe(expected)
  })

  it('should handle Infinity and NaN as null', () => {
    expect(jsonToYaml(Infinity)).toBe('null\n')
    expect(jsonToYaml(NaN)).toBe('null\n')
  })

  it('should handle a realistic OpenAPI spec snippet', () => {
    const spec = {
      openapi: '3.0.3',
      info: {
        title: 'Moost API',
        version: '1.0.0',
      },
      paths: {
        '/pets': {
          get: {
            tags: ['pets'],
            parameters: [
              {
                name: 'limit',
                in: 'query',
                required: false,
                schema: { type: 'integer' },
              },
            ],
            responses: {
              '200': {
                description: 'A list of pets',
                content: {
                  'application/json': {
                    schema: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/Pet' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      components: {
        schemas: {
          Pet: {
            type: 'object',
            required: ['name'],
            properties: {
              name: { type: 'string' },
              tag: { type: 'string' },
            },
          },
        },
      },
    }
    const yaml = jsonToYaml(spec)
    expect(yaml).toContain('openapi: 3.0.3')
    expect(yaml).toContain('  title: Moost API')
    expect(yaml).toContain('  /pets:')
    expect(yaml).toContain('$ref: "#/components/schemas/Pet"')
    expect(yaml).toContain('    Pet:')
    expect(yaml).toContain('      required:')
    expect(yaml).toContain('        - name')
  })

  it('should handle mixed arrays with nested objects', () => {
    const input = [1, { a: 2 }, 'three']
    const expected = '- 1\n- a: 2\n- three\n'
    expect(jsonToYaml(input)).toBe(expected)
  })

  it('should handle keys that need quoting', () => {
    const input = { 'x-custom': 'value', '*': 'wildcard' }
    expect(jsonToYaml(input)).toContain('x-custom')
    expect(jsonToYaml(input)).toContain('"*"')
  })

  it('should handle string starting with special chars', () => {
    expect(jsonToYaml('!important')).toBe('"!important"\n')
    expect(jsonToYaml('&anchor')).toBe('"&anchor"\n')
    expect(jsonToYaml('*alias')).toBe('"*alias"\n')
  })
})
