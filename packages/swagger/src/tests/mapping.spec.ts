import { MoostHttp } from '@moostjs/event-http'
import type { TControllerOverview } from 'moost'
import { Moost } from 'moost'

import { mapToSwaggerSpec } from '../mapping'
import { SwaggerControllerTest } from './mapping.artifacts'

const app = new Moost()
app.adapter(new MoostHttp())
app.registerControllers(SwaggerControllerTest)
let metadata: TControllerOverview[]
let spec: ReturnType<typeof mapToSwaggerSpec>
describe('mapping', () => {
  beforeAll(async () => {
    await app.init()
    metadata = app.getControllersOverview()
    spec = mapToSwaggerSpec(metadata)
  })
  it('must map controllersOverview to OpenAPI spec', () => {
    const spec = mapToSwaggerSpec(metadata)
    expect(spec.info).toEqual({
      title: 'API Documentation',
      version: '1.0.0',
    })
    expect(spec.openapi).toBe('3.0.0')
    expect(spec.paths).toBeDefined()
    expect(spec.paths['/prefix/test-query']).toBeDefined()
    expect(spec.paths['/prefix/test-query-single']).toBeDefined()
    expect(spec.paths['/prefix/test-response/{name}']).toBeDefined()
    expect(spec.paths['/prefix/test-query'].get).toBeDefined()
    expect(spec.paths['/prefix/test-query-single'].get).toBeDefined()
    expect(spec.paths['/prefix/test-response/{name}'].get).toBeDefined()
    expect(spec.paths['/prefix/postBody'].post).toBeDefined()
    expect(spec.paths['/prefix/postBodyExplicit'].post).toBeDefined()
  })

  it('must parse complex query type', () => {
    const toTest = spec.paths['/prefix/test-query'].get
    expect(toTest.operationId).toEqual('GET__prefix_test_query')
    expect(toTest.parameters).toHaveLength(2)
    expect(toTest.parameters[0]).toEqual({
      description: undefined,
      in: 'query',
      name: 'name',
      required: true,
      schema: {
        maxLength: 20,
        minLength: 10,
        pattern: 'test',
        type: 'string',
      },
    })
    expect(toTest.parameters[1]).toEqual({
      description: undefined,
      in: 'query',
      name: 'age',
      required: false,
      schema: {
        type: 'number',
        maximum: 55,
        minimum: 4,
      },
    })
  })

  it('must parse single query arg', () => {
    const toTest = spec.paths['/prefix/test-query-single'].get
    expect(toTest.operationId).toEqual('GET__prefix_test_query_single')
    expect(toTest.parameters).toHaveLength(2)
    expect(toTest.parameters[0]).toEqual({
      description: undefined,
      in: 'query',
      name: 'foo',
      required: false,
      schema: {
        type: 'string',
      },
    })
    expect(toTest.parameters[1]).toEqual({
      description: undefined,
      in: 'query',
      name: 'bar',
      required: false,
      schema: {
        maximum: 100,
        type: 'number',
      },
    })
  })
  it('must parse param type', () => {
    const toTest = spec.paths['/prefix/test-response/{name}'].get
    expect(toTest.operationId).toEqual('GET__prefix_test_response___name__')
    expect(toTest.parameters).toHaveLength(1)
    expect(toTest.parameters[0]).toEqual({
      description: undefined,
      in: 'path',
      name: 'name',
      required: true,
      schema: {
        minLength: 10,
        type: 'string',
      },
    })
  })
  it('must parse reponse type', () => {
    const toTest = spec.paths['/prefix/test-response/{name}'].get
    expect(toTest.responses).toBeDefined()
    expect(toTest.responses).toEqual({
      '200': {
        content: {
          '*/*': {
            schema: {
              $ref: '#/components/schemas/SwaggerTypeTest',
              example: {
                name: 'Rick',
                age: 32,
                array: ['-'],
              },
            },
          },
        },
      },
      '400': {
        content: {
          'text/plain': {
            schema: {
              type: 'string',
              example: 'example',
            },
          },
        },
      },
      '404': {
        content: {
          '*/*': {
            schema: {
              type: 'string',
              example: 'not found',
            },
          },
        },
      },
    })
    expect(spec.components).toBeDefined()
    expect(spec.components.schemas).toBeDefined()
    expect(spec.components.schemas.SwaggerTypeTest).toBeDefined()
    expect(spec.components.schemas.SwaggerTypeTest.type).toEqual('object')
    expect(spec.components.schemas.SwaggerTypeTest.properties).toBeDefined()
    expect(spec.components.schemas.SwaggerTypeTest.properties?.age).toBeDefined()
    expect(spec.components.schemas.SwaggerTypeTest.properties?.age).toEqual({
      maximum: 55,
      minimum: 4,
      type: 'number',
    })
    expect(spec.components.schemas.SwaggerTypeTest.properties?.array).toBeDefined()
    expect(spec.components.schemas.SwaggerTypeTest.properties?.array).toEqual({
      items: {
        nullable: true,
        type: 'string',
      },
      maxItems: 2,
      minItems: 1,
      type: 'array',
    })
    expect(spec.components.schemas.SwaggerTypeTest.properties?.name).toBeDefined()
    expect(spec.components.schemas.SwaggerTypeTest.properties?.name).toEqual({
      maxLength: 20,
      minLength: 10,
      pattern: 'test',
      type: 'string',
    })
    expect(spec.components.schemas.SwaggerTypeTest.required).toEqual(['name', 'array'])
    expect(spec.components.schemas.SwaggerTypeTest.example).toEqual({
      name: 'John',
      age: 54,
      array: ['example'],
    })
  })
  it('must parse body by type', () => {
    const toTest = spec.paths['/prefix/postBody'].post
    expect(toTest.operationId).toEqual('POST__prefix_postBody')
    expect(toTest.requestBody).toBeDefined()
    expect(toTest.requestBody?.required).toBeFalsy()
    expect(toTest.requestBody?.content).toHaveProperty('application/json')
    expect(toTest.requestBody?.content['application/json']).toHaveProperty('schema')
    expect(toTest.requestBody?.content['application/json'].schema).toEqual({
      $ref: '#/components/schemas/SwaggerTypeTest',
    })
  })
  it('must parse body from decorator', () => {
    const toTest = spec.paths['/prefix/postBodyExplicit'].post
    expect(toTest.operationId).toEqual('POST__prefix_postBodyExplicit')
    expect(toTest.requestBody).toBeDefined()
    expect(toTest.requestBody?.required).toBeFalsy()
    expect(toTest.requestBody?.content).toHaveProperty('application/json')
    expect(toTest.requestBody?.content['application/json']).toHaveProperty('schema')
    expect(toTest.requestBody?.content['application/json'].schema).toEqual({
      $ref: '#/components/schemas/SwaggerTypeTest',
    })
  })
  it('must add header param', () => {
    const toTest = spec.paths['/prefix/withHeader'].get
    expect(toTest.parameters).toHaveLength(1)
    expect(toTest.parameters[0]).toBeDefined()
    expect(toTest.parameters[0].in).toEqual('header')
    expect(toTest.parameters[0].name).toEqual('X-Auth')
    expect(toTest.parameters[0].schema).toEqual({ type: 'string' })
  })
})
