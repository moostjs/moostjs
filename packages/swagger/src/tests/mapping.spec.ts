import { MoostHttp } from '@moostjs/event-http'
import type { TControllerOverview } from 'moost'
import { Moost } from 'moost'

import { mapToSwaggerSpec } from '../mapping'
import {
  AllPublicController,
  ArrayController,
  CollisionController,
  ControllerSecurityController,
  DescribedSchemaController,
  ExampleDataController,
  ExampleDataOverrideController,
  ExcludedController,
  MultiAuthController,
  PartialExcludeController,
  PrimitiveController,
  RequiredBodyController,
  SecuredController,
  StatusCodeController,
  SwaggerControllerTest,
  TaggedController,
} from './mapping.artifacts'
import { describe, it, expect, beforeAll } from 'vitest'

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
    expect(toTest.parameters).toHaveLength(3)
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
    expect(toTest.parameters[2]).toEqual({
      description: undefined,
      in: 'query',
      name: 'array',
      required: true,
      schema: {
        type: 'array',
        minItems: 1,
        maxItems: 2,
        items: {
          nullable: true,
          type: 'string',
        },
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
        $ref: '#/components/schemas/SwaggerNameParam',
      },
    })
    expect(spec.components.schemas.SwaggerNameParam).toEqual({
      minLength: 10,
      type: 'string',
    })
  })
  it('must parse reponse type', () => {
    const toTest = spec.paths['/prefix/test-response/{name}'].get
    expect(toTest.responses).toBeDefined()
    expect(toTest.responses).toEqual({
      '200': {
        description: 'OK',
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
        description: 'Error text',
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
        description: 'Not Found',
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
    expect(spec.components.schemas.SwaggerTypeTest.title).toEqual('Type Definition')
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

  it('must use custom title and version from options', () => {
    const custom = mapToSwaggerSpec(metadata, { title: 'My API', version: '2.0.0' })
    expect(custom.info.title).toBe('My API')
    expect(custom.info.version).toBe('2.0.0')
  })

  it('must use default version when only title is provided', () => {
    const custom = mapToSwaggerSpec(metadata, { title: 'Custom Title' })
    expect(custom.info.title).toBe('Custom Title')
    expect(custom.info.version).toBe('1.0.0')
  })
})

describe('@SwaggerExclude', () => {
  const excludeApp = new Moost()
  excludeApp.adapter(new MoostHttp())
  excludeApp.registerControllers(ExcludedController, PartialExcludeController)
  let spec: ReturnType<typeof mapToSwaggerSpec>

  beforeAll(async () => {
    await excludeApp.init()
    spec = mapToSwaggerSpec(excludeApp.getControllersOverview())
  })

  it('must exclude entire controller with @SwaggerExclude on class', () => {
    expect(spec.paths['/excluded-ctrl/visible']).toBeUndefined()
  })

  it('must exclude individual handler with @SwaggerExclude on method', () => {
    expect(spec.paths['/partial-exclude/hidden']).toBeUndefined()
  })

  it('must keep non-excluded handlers visible', () => {
    expect(spec.paths['/partial-exclude/visible']).toBeDefined()
    expect(spec.paths['/partial-exclude/visible'].get).toBeDefined()
  })
})

describe('@SwaggerTag and @Description', () => {
  const tagApp = new Moost()
  tagApp.adapter(new MoostHttp())
  tagApp.registerControllers(TaggedController, DescribedSchemaController)
  let spec: ReturnType<typeof mapToSwaggerSpec>

  beforeAll(async () => {
    await tagApp.init()
    spec = mapToSwaggerSpec(tagApp.getControllersOverview())
  })

  it('must merge controller-level and handler-level tags', () => {
    const tags = spec.paths['/tagged/both-tags'].get.tags
    expect(tags).toEqual(['admin', 'users'])
  })

  it('must include only controller-level tag when handler has none', () => {
    const tags = spec.paths['/tagged/controller-tag-only'].get.tags
    expect(tags).toEqual(['admin'])
  })

  it('must set summary from @Description on handler', () => {
    const endpoint = spec.paths['/tagged/described'].get
    expect(endpoint.summary).toBe('Get user details')
    expect(endpoint.tags).toEqual(['admin', 'detail'])
  })

  it('must apply @SwaggerDescription to component schema', () => {
    expect(spec.components.schemas.DescribedSchema).toBeDefined()
    expect(spec.components.schemas.DescribedSchema.description).toBe('A described schema')
  })
})

describe('PUT/DELETE status codes', () => {
  const statusApp = new Moost()
  statusApp.adapter(new MoostHttp())
  statusApp.registerControllers(StatusCodeController)
  let spec: ReturnType<typeof mapToSwaggerSpec>

  beforeAll(async () => {
    await statusApp.init()
    spec = mapToSwaggerSpec(statusApp.getControllersOverview())
  })

  it('must use status 200 for PUT when no explicit status code', () => {
    const responses = spec.paths['/status-codes/update'].put.responses
    expect(responses).toBeDefined()
    expect(responses!['200']).toBeDefined()
    expect(responses!['0']).toBeUndefined()
  })

  it('must use status 204 for DELETE when no explicit status code', () => {
    const responses = spec.paths['/status-codes/remove'].delete.responses
    expect(responses).toBeDefined()
    expect(responses!['204']).toBeDefined()
    expect(responses!['0']).toBeUndefined()
  })
})

describe('primitive constructor types', () => {
  const primApp = new Moost()
  primApp.adapter(new MoostHttp())
  primApp.registerControllers(PrimitiveController)
  let spec: ReturnType<typeof mapToSwaggerSpec>

  beforeAll(async () => {
    await primApp.init()
    spec = mapToSwaggerSpec(primApp.getControllersOverview())
  })

  it('must map Number to {type: "number"}', () => {
    const schema = spec.paths['/primitives/number'].get.responses!['200'].content['*/*'].schema
    expect(schema).toEqual({ type: 'number' })
  })

  it('must map Boolean to {type: "boolean"}', () => {
    const schema = spec.paths['/primitives/boolean'].get.responses!['200'].content['*/*'].schema
    expect(schema).toEqual({ type: 'boolean' })
  })

  it('must map Date to {type: "string", format: "date-time"}', () => {
    const schema = spec.paths['/primitives/date'].get.responses!['200'].content['*/*'].schema
    expect(schema).toEqual({ type: 'string', format: 'date-time' })
  })

  it('must map Array to {type: "array"}', () => {
    const schema = spec.paths['/primitives/array'].get.responses!['200'].content['*/*'].schema
    expect(schema).toEqual({ type: 'array' })
  })

  it('must map Object to {type: "object"}', () => {
    const schema = spec.paths['/primitives/object'].get.responses!['200'].content['*/*'].schema
    expect(schema).toEqual({ type: 'object' })
  })
})

describe('required vs optional body', () => {
  const bodyApp = new Moost()
  bodyApp.adapter(new MoostHttp())
  bodyApp.registerControllers(RequiredBodyController)
  let spec: ReturnType<typeof mapToSwaggerSpec>

  beforeAll(async () => {
    await bodyApp.init()
    spec = mapToSwaggerSpec(bodyApp.getControllersOverview())
  })

  it('must set requestBody.required to true when @Body has no @Optional', () => {
    const reqBody = spec.paths['/required-body/required'].post.requestBody
    expect(reqBody).toBeDefined()
    expect(reqBody!.required).toBe(true)
  })

  it('must set requestBody.required to false when @Body has @Optional', () => {
    const reqBody = spec.paths['/required-body/optional'].post.requestBody
    expect(reqBody).toBeDefined()
    expect(reqBody!.required).toBe(false)
  })
})

describe('array type in response', () => {
  const arrayApp = new Moost()
  arrayApp.adapter(new MoostHttp())
  arrayApp.registerControllers(ArrayController)
  let spec: ReturnType<typeof mapToSwaggerSpec>

  beforeAll(async () => {
    await arrayApp.init()
    spec = mapToSwaggerSpec(arrayApp.getControllersOverview())
  })

  it('must resolve response with toJsonSchema class as component ref', () => {
    const schema = spec.paths['/arrays/typed-array'].get.responses!['200'].content['*/*'].schema
    expect(schema).toEqual({ $ref: '#/components/schemas/ArrayItemType' })
    expect(spec.components.schemas.ArrayItemType).toBeDefined()
    expect(spec.components.schemas.ArrayItemType.type).toBe('object')
    expect(spec.components.schemas.ArrayItemType.properties).toHaveProperty('value')
  })
})

describe('component name collision', () => {
  const collisionApp = new Moost()
  collisionApp.adapter(new MoostHttp())
  collisionApp.registerControllers(CollisionController)
  let spec: ReturnType<typeof mapToSwaggerSpec>

  beforeAll(async () => {
    await collisionApp.init()
    spec = mapToSwaggerSpec(collisionApp.getControllersOverview())
  })

  it('must disambiguate component names for different types with same name', () => {
    expect(spec.components.schemas.CollisionType).toBeDefined()
    expect(spec.components.schemas.CollisionType_1).toBeDefined()
  })

  it('must assign correct schemas to disambiguated names', () => {
    const first = spec.components.schemas.CollisionType
    const second = spec.components.schemas.CollisionType_1
    const hasAlpha = first.properties?.alpha ? first : second
    const hasBeta = first.properties?.beta ? first : second
    expect(hasAlpha.properties?.alpha).toEqual({ type: 'string' })
    expect(hasBeta.properties?.beta).toEqual({ type: 'number' })
  })

  it('must reference correct disambiguated component in each handler', () => {
    const firstRef = spec.paths['/collision/first'].get.responses!['200'].content['*/*'].schema
    const secondRef = spec.paths['/collision/second'].get.responses!['200'].content['*/*'].schema
    expect(firstRef.$ref).toBeDefined()
    expect(secondRef.$ref).toBeDefined()
    expect(firstRef.$ref).not.toBe(secondRef.$ref)
  })
})

describe('toExampleData() duck-typing', () => {
  const exApp = new Moost()
  exApp.adapter(new MoostHttp())
  exApp.registerControllers(ExampleDataController, ExampleDataOverrideController)
  let spec: ReturnType<typeof mapToSwaggerSpec>

  beforeAll(async () => {
    await exApp.init()
    spec = mapToSwaggerSpec(exApp.getControllersOverview())
  })

  it('must auto-populate example from toExampleData()', () => {
    expect(spec.components.schemas.ExampleDataType).toBeDefined()
    expect(spec.components.schemas.ExampleDataType.example).toEqual({
      name: 'Alice',
      count: 42,
    })
  })

  it('must prefer @SwaggerExample over toExampleData()', () => {
    expect(spec.components.schemas.ExampleDataWithOverride).toBeDefined()
    expect(spec.components.schemas.ExampleDataWithOverride.example).toEqual({
      name: 'Override',
      count: 99,
    })
  })
})

describe('security schemes', () => {
  const secApp = new Moost()
  secApp.adapter(new MoostHttp())
  secApp.registerControllers(
    SecuredController,
    AllPublicController,
    MultiAuthController,
    ControllerSecurityController,
  )
  let spec: ReturnType<typeof mapToSwaggerSpec>

  beforeAll(async () => {
    await secApp.init()
    spec = mapToSwaggerSpec(secApp.getControllersOverview())
  })

  it('must auto-discover securitySchemes from authTransports', () => {
    expect(spec.components.securitySchemes).toBeDefined()
    expect(spec.components.securitySchemes!.bearerAuth).toEqual({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
    })
  })

  it('must auto-discover multiple security schemes from multi-transport guard', () => {
    expect(spec.components.securitySchemes!.apiKeyAuth).toEqual({
      type: 'apiKey',
      name: 'X-API-Key',
      in: 'header',
    })
  })

  it('must set per-operation security from controller authTransports', () => {
    const security = spec.paths['/secured/protected'].get.security
    expect(security).toEqual([{ bearerAuth: [] }])
  })

  it('must emit security: [] for @SwaggerPublic handler', () => {
    const security = spec.paths['/secured/public'].get.security
    expect(security).toEqual([])
  })

  it('must use @SwaggerSecurity override on handler', () => {
    const security = spec.paths['/secured/custom-security'].get.security
    expect(security).toEqual([{ customScheme: ['read', 'write'] }])
  })

  it('must emit security: [] for controller-level @SwaggerPublic', () => {
    const security = spec.paths['/all-public/open'].get.security
    expect(security).toEqual([])
  })

  it('must emit multiple security requirements for multi-transport guard', () => {
    const security = spec.paths['/multi-auth/multi'].get.security
    expect(security).toEqual([{ bearerAuth: [] }, { apiKeyAuth: [] }])
  })

  it('must use controller-level @SwaggerSecurity', () => {
    const security = spec.paths['/ctrl-security/inherited'].get.security
    expect(security).toEqual([{ oauth2: ['read'] }])
  })

  it('must allow handler @SwaggerPublic to override controller @SwaggerSecurity', () => {
    const security = spec.paths['/ctrl-security/override-public'].get.security
    expect(security).toEqual([])
  })

  it('must omit security for endpoints with no auth configuration', () => {
    const noAuthApp = new Moost()
    noAuthApp.adapter(new MoostHttp())
    noAuthApp.registerControllers(PrimitiveController)
    return noAuthApp.init().then(() => {
      const noAuthSpec = mapToSwaggerSpec(noAuthApp.getControllersOverview())
      const endpoint = noAuthSpec.paths['/primitives/number'].get
      expect(endpoint.security).toBeUndefined()
    })
  })

  it('must merge manual securitySchemes from options with auto-discovered', () => {
    const customSpec = mapToSwaggerSpec(secApp.getControllersOverview(), {
      securitySchemes: {
        myCustom: { type: 'http', scheme: 'digest' },
      },
    })
    expect(customSpec.components.securitySchemes!.myCustom).toEqual({
      type: 'http',
      scheme: 'digest',
    })
    expect(customSpec.components.securitySchemes!.bearerAuth).toBeDefined()
  })

  it('must set global security from options', () => {
    const globalSecSpec = mapToSwaggerSpec(secApp.getControllersOverview(), {
      security: [{ bearerAuth: [] }],
    })
    expect(globalSecSpec.security).toEqual([{ bearerAuth: [] }])
  })

  it('must not include securitySchemes when no auth is configured', () => {
    const noAuthApp = new Moost()
    noAuthApp.adapter(new MoostHttp())
    noAuthApp.registerControllers(PrimitiveController)
    return noAuthApp.init().then(() => {
      const noAuthSpec = mapToSwaggerSpec(noAuthApp.getControllersOverview())
      expect(noAuthSpec.components.securitySchemes).toBeUndefined()
    })
  })
})

describe('OpenAPI 3.1 support', () => {
  let spec31: ReturnType<typeof mapToSwaggerSpec>
  let spec30: ReturnType<typeof mapToSwaggerSpec>

  beforeAll(async () => {
    spec31 = mapToSwaggerSpec(metadata, { openapiVersion: '3.1' })
    spec30 = mapToSwaggerSpec(metadata)
  })

  it('must set openapi version to 3.1.0', () => {
    expect(spec31.openapi).toBe('3.1.0')
  })

  it('must default to 3.0.0 when openapiVersion is not set', () => {
    expect(spec30.openapi).toBe('3.0.0')
  })

  it('must convert nullable to type array in component schemas', () => {
    const arrayItems = spec31.components.schemas.SwaggerTypeTest?.properties?.array?.items
    expect(arrayItems).toBeDefined()
    const items = arrayItems as { type?: string | string[]; nullable?: boolean }
    expect(items.nullable).toBeUndefined()
    expect(items.type).toEqual(['string', 'null'])
  })

  it('must preserve nullable in 3.0 mode', () => {
    const arrayItems = spec30.components.schemas.SwaggerTypeTest?.properties?.array?.items
    expect(arrayItems).toBeDefined()
    const items = arrayItems as { type?: string; nullable?: boolean }
    expect(items.nullable).toBe(true)
    expect(items.type).toBe('string')
  })

  it('must not alter non-nullable schemas in 3.1 mode', () => {
    const nameSchema = spec31.components.schemas.SwaggerTypeTest?.properties?.name
    expect(nameSchema).toBeDefined()
    expect(nameSchema!.type).toBe('string')
    expect((nameSchema as { nullable?: boolean }).nullable).toBeUndefined()
  })

  it('must convert nullable in inline response schemas', () => {
    const queryParams = spec31.paths['/prefix/test-query'].get.parameters
    const arrayParam = queryParams.find((p) => p.name === 'array')
    expect(arrayParam).toBeDefined()
    const items = arrayParam!.schema.items as { type?: string | string[]; nullable?: boolean }
    expect(items.nullable).toBeUndefined()
    expect(items.type).toEqual(['string', 'null'])
  })

  it('must preserve all other schema properties in 3.1 mode', () => {
    const schema = spec31.components.schemas.SwaggerTypeTest
    expect(schema.type).toBe('object')
    expect(schema.required).toEqual(['name', 'array'])
    expect(schema.properties?.name?.minLength).toBe(10)
    expect(schema.properties?.name?.maxLength).toBe(20)
    expect(schema.properties?.age?.minimum).toBe(4)
    expect(schema.properties?.age?.maximum).toBe(55)
  })
})
