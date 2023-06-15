import { TControllerOverview } from 'moost'
import { mapToSwaggerSpec } from '../mapping'

class Queries {
    name = 'name'

    age = 26
}

const metadata = [
    {
        'meta': {
            'injectable': true,
            'controller': {
                'prefix': 'api',
            },
            'swaggerTags': [
                'Main API',
            ],
            'description': 'API swagger section description',
        },
        'computedPrefix': '/api',
        'handlers': [
            {
                'meta': {
                    'params': [
                        {
                            'paramSource': 'ROUTE',
                            'paramName': 'name',
                            type: String,
                            'description': 'Description of "name" route parameter',
                        },
                    ],
                    'handlers': [
                        {
                            'method': 'GET',
                            'path': 'hello/:name',
                            'type': 'HTTP',
                        },
                    ],
                    'description': 'Description of hello/<name> endpoint',
                },
                'path': 'hello/:name',
                'type': 'HTTP',
                'method': 'greet',
                'handler': {
                    'method': 'GET',
                    'path': 'hello/:name',
                    'type': 'HTTP',
                },
                'registeredAs': [
                    {
                        'path': '/api/hello/{name}',
                        'args': [
                            'name',
                        ],
                    },
                ],
            },
            {
                'meta': {
                    'params': [
                        {
                            type: Queries,
                            'paramSource': 'QUERY',
                            'paramName': 'Query',
                            'optional': true,
                        },
                    ],
                    'handlers': [
                        {
                            'method': 'GET',
                            'path': 'another',
                            'type': 'HTTP',
                        },
                    ],
                    'description': 'Description of another endpoint',
                },
                'path': 'another',
                'type': 'HTTP',
                'method': 'another',
                'handler': {
                    'method': 'GET',
                    'path': 'another',
                    'type': 'HTTP',
                },
                'registeredAs': [
                    {
                        'path': '/api/another',
                        'args': [],
                    },
                ],
            },
        ],
    },
] as unknown as TControllerOverview[]

describe('mapping', () => {
    it('must map controllersOverview to OpenAPI spec', () => {
        const spec = mapToSwaggerSpec(metadata)
        expect(spec.info).toEqual({
            title: 'API Documentation',
            version: '1.0.0',
        })
        expect(spec.openapi).toBe('3.0.0')
        expect(spec.paths).toBeDefined()
        expect(spec.paths['/api/another']).toMatchInlineSnapshot(`
{
  "get": {
    "parameters": [
      {
        "description": undefined,
        "in": "query",
        "name": "name",
        "required": false,
        "schema": {
          "type": "string",
        },
      },
      {
        "description": undefined,
        "in": "query",
        "name": "age",
        "required": false,
        "schema": {
          "type": "number",
        },
      },
    ],
    "summary": "Description of another endpoint",
    "tags": [
      "Main API",
    ],
  },
}
`)
        expect(spec.paths['/api/hello/{name}']).toMatchInlineSnapshot(`
{
  "get": {
    "parameters": [
      {
        "description": "Description of "name" route parameter",
        "in": "path",
        "name": "name",
        "required": false,
        "schema": {
          "type": "string",
        },
      },
    ],
    "summary": "Description of hello/<name> endpoint",
    "tags": [
      "Main API",
    ],
  },
}
`)
    })
})
