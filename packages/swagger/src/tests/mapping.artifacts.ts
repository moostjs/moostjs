import { Body, Delete, Get, Post, Put, Query } from '@moostjs/event-http'
import { Controller, Description, Id, Label, Optional, Param } from 'moost'

import {
  SwaggerCallback,
  SwaggerDeprecated,
  SwaggerDescription,
  SwaggerExample,
  SwaggerExclude,
  SwaggerExternalDocs,
  SwaggerLink,
  SwaggerOperationId,
  SwaggerParam,
  SwaggerPublic,
  SwaggerRequestBody,
  SwaggerResponse,
  SwaggerSecurity,
  SwaggerTag,
} from '../decorators'
import { getSwaggerMate } from '../swagger.mate'

/**
 * Helper to set authTransports metadata directly on a class.
 * In production, @Authenticate(guard) from event-http stores this.
 * For swagger tests, we set it directly to avoid workspace resolution issues
 * (published moost@0.5.33 doesn't have the Authenticate decorator yet).
 */
function AuthTransports(transports: Record<string, unknown>) {
  return getSwaggerMate().decorate('authTransports' as 'swaggerTags', transports as never)
}

@Label('Type Definition')
@SwaggerExample({
  name: 'John',
  age: 54,
  array: ['example'],
})
export class SwaggerTypeTest {
  name = 'name'
  age = 26
  array: (string | null)[] = []

  static toJsonSchema() {
    return {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          minLength: 10,
          maxLength: 20,
          pattern: 'test',
        },
        age: {
          type: 'number',
          minimum: 4,
          maximum: 55,
        },
        array: {
          type: 'array',
          minItems: 1,
          maxItems: 2,
          items: {
            type: 'string',
            nullable: true,
          },
        },
      },
      required: ['name', 'array'],
    }
  }
}

class SwaggerQuerySingle {
  static toJsonSchema() {
    return {
      type: 'object',
      properties: {
        foo: {
          type: 'string',
        },
        bar: {
          type: 'number',
          maximum: 100,
        },
      },
      required: [],
    }
  }
}

class SwaggerNameParam {
  static toJsonSchema() {
    return {
      type: 'string',
      minLength: 10,
    }
  }
}

@Controller('prefix')
export class SwaggerControllerTest {
  @Get('test-query')
  testQuery(@Query() query: SwaggerTypeTest) {
    return query
  }

  @Get('test-query-single')
  testQuerySingle(@Query() query: SwaggerQuerySingle) {
    return query
  }

  @Get('test-response/:name')
  @SwaggerResponse(SwaggerTypeTest, {
    name: 'Rick',
    age: 32,
    array: ['-'],
  })
  @SwaggerResponse(400, {
    contentType: 'text/plain',
    description: 'Error text',
    response: {
      type: 'string',
      example: 'example',
    },
  })
  @SwaggerResponse(404, String, 'not found')
  testResponse(@Param('name') name: SwaggerNameParam) {
    const r = new SwaggerTypeTest()
    r.name = String(name)
    return r
  }

  @Post('postBody')
  postTest(@Optional() @Body() body: SwaggerTypeTest) {
    return body
  }

  @SwaggerRequestBody(SwaggerTypeTest)
  @Post('postBodyExplicit')
  postTest2(@Optional() @Body() body: unknown) {
    return body
  }

  @Get()
  @SwaggerParam({
    name: 'X-Auth',
    in: 'header',
    type: String,
  })
  withHeader() {
    return 'ok'
  }
}

// --- Multiple content types per status code artifacts ---

@Controller('multi-content')
export class MultiContentTypeController {
  @SwaggerResponse(200, {
    contentType: 'application/json',
    response: SwaggerTypeTest,
  })
  @SwaggerResponse(200, {
    contentType: 'application/xml',
    response: { type: 'string' },
  })
  @Get('dual')
  dualContentType() {
    return {}
  }
}

// --- Response headers artifacts ---

@Controller('response-headers')
export class ResponseHeadersController {
  @Get('paginated')
  @SwaggerResponse(200, {
    response: { type: 'array', items: { type: 'string' } },
    headers: {
      'X-Total-Count': { type: Number, description: 'Total number of items', required: true },
      'X-Page-Size': { type: Number, description: 'Items per page' },
    },
  })
  paginatedEndpoint() {
    return []
  }

  @Get('rate-limited')
  @SwaggerResponse(200, {
    response: { type: 'string' },
    headers: {
      'X-Rate-Limit': { type: Number, example: 100 },
    },
  })
  rateLimitedEndpoint() {
    return 'ok'
  }

  @Get('no-headers')
  @SwaggerResponse(200, { response: { type: 'string' } })
  noHeadersEndpoint() {
    return 'ok'
  }
}

// --- @SwaggerExclude artifacts ---

@SwaggerExclude()
@Controller('excluded-ctrl')
export class ExcludedController {
  @Get('visible')
  handler() {
    return 'should not appear'
  }
}

@Controller('partial-exclude')
export class PartialExcludeController {
  @SwaggerExclude()
  @Get('hidden')
  hiddenHandler() {
    return 'hidden'
  }

  @Get('visible')
  visibleHandler() {
    return 'visible'
  }
}

// --- @SwaggerTag + @Description artifacts ---

@SwaggerTag('admin')
@Controller('tagged')
export class TaggedController {
  @SwaggerTag('users')
  @Get('both-tags')
  bothTags() {
    return 'ok'
  }

  @Get('controller-tag-only')
  controllerTagOnly() {
    return 'ok'
  }

  @Description('Get user details')
  @SwaggerTag('detail')
  @Get('described')
  describedHandler() {
    return 'ok'
  }

  @Label('Get user summary')
  @Description('Returns a detailed user summary including activity history')
  @Get('labeled')
  labeledHandler() {
    return 'ok'
  }
}

// --- PUT/DELETE status code artifacts ---

@Controller('status-codes')
export class StatusCodeController {
  @Put('update')
  @SwaggerResponse({ type: 'string' })
  updateHandler() {
    return 'updated'
  }

  @Delete('remove')
  @SwaggerResponse({ type: 'string' })
  deleteHandler() {
    return 'deleted'
  }
}

// --- Primitive constructor artifacts ---

@Controller('primitives')
export class PrimitiveController {
  @Get('number')
  @SwaggerResponse(Number)
  getNumber() {
    return 42
  }

  @Get('boolean')
  @SwaggerResponse(Boolean)
  getBoolean() {
    return true
  }

  @Get('date')
  @SwaggerResponse(Date)
  getDate() {
    return new Date()
  }

  @Get('array')
  @SwaggerResponse(Array)
  getArray() {
    return []
  }

  @Get('object')
  @SwaggerResponse(Object)
  getObject() {
    return {}
  }
}

// --- Required body artifacts ---

@Controller('required-body')
export class RequiredBodyController {
  @Post('required')
  postRequired(@Body() body: SwaggerTypeTest) {
    return body
  }

  @Post('optional')
  postOptional(@Optional() @Body() body: SwaggerTypeTest) {
    return body
  }
}

// --- Array type artifacts ---

class ArrayItemType {
  static toJsonSchema() {
    return {
      type: 'object',
      properties: {
        value: { type: 'string' },
      },
    }
  }
}

@Controller('arrays')
export class ArrayController {
  @Get('typed-array')
  @SwaggerResponse({ response: ArrayItemType })
  getTypedArray() {
    return []
  }
}

// --- Component name collision artifacts ---

class CollisionType {
  static toJsonSchema() {
    return {
      type: 'object',
      properties: {
        alpha: { type: 'string' },
      },
    }
  }
}

const CollisionType2 = (() => {
  const cls = class CollisionType {
    static toJsonSchema() {
      return {
        type: 'object',
        properties: {
          beta: { type: 'number' },
        },
      }
    }
  }
  return cls
})()

@Controller('collision')
export class CollisionController {
  @Get('first')
  @SwaggerResponse(CollisionType)
  getFirst() {
    return {}
  }

  @Get('second')
  @SwaggerResponse(CollisionType2)
  getSecond() {
    return {}
  }
}

// --- @SwaggerDescription on schema artifacts ---

// --- toExampleData() duck-typing artifacts ---

class ExampleDataType {
  static toJsonSchema() {
    return {
      type: 'object',
      properties: {
        name: { type: 'string' },
        count: { type: 'number' },
      },
      required: ['name'],
    }
  }

  static toExampleData() {
    return { name: 'Alice', count: 42 }
  }
}

@Controller('example-data')
export class ExampleDataController {
  @Get('auto')
  @SwaggerResponse(ExampleDataType)
  getAuto() {
    return {}
  }
}

@SwaggerExample({ name: 'Override', count: 99 })
class ExampleDataWithOverride {
  static toJsonSchema() {
    return {
      type: 'object',
      properties: {
        name: { type: 'string' },
        count: { type: 'number' },
      },
    }
  }

  static toExampleData() {
    return { name: 'Fallback', count: 0 }
  }
}

@Controller('example-data-override')
export class ExampleDataOverrideController {
  @Get('item')
  @SwaggerResponse(ExampleDataWithOverride)
  getItem() {
    return {}
  }
}

@SwaggerDescription('A described schema')
export class DescribedSchema {
  static toJsonSchema() {
    return {
      type: 'object',
      properties: {
        id: { type: 'number' },
      },
    }
  }
}

@Controller('described-schema')
export class DescribedSchemaController {
  @Get('item')
  @SwaggerResponse(DescribedSchema)
  getItem() {
    return {}
  }
}

// --- Security scheme artifacts ---
// AuthTransports simulates what @Intercept(defineAuthGuard(...)) does at the metadata level.

@AuthTransports({ bearer: { format: 'JWT' } })
@Controller('secured')
export class SecuredController {
  @Get('protected')
  protectedEndpoint() {
    return 'ok'
  }

  @SwaggerPublic()
  @Get('public')
  publicEndpoint() {
    return 'ok'
  }

  @SwaggerSecurity('customScheme', ['read', 'write'])
  @Get('custom-security')
  customSecurity() {
    return 'ok'
  }
}

@SwaggerPublic()
@Controller('all-public')
export class AllPublicController {
  @Get('open')
  openEndpoint() {
    return 'ok'
  }
}

@AuthTransports({ bearer: { format: 'JWT' }, apiKey: { name: 'X-API-Key', in: 'header' } })
@Controller('multi-auth')
export class MultiAuthController {
  @Get('multi')
  multiEndpoint() {
    return 'ok'
  }
}

@SwaggerSecurity('oauth2', ['read'])
@Controller('ctrl-security')
export class ControllerSecurityController {
  @Get('inherited')
  inheritedEndpoint() {
    return 'ok'
  }

  @SwaggerPublic()
  @Get('override-public')
  overridePublic() {
    return 'ok'
  }
}

// --- @SwaggerDeprecated artifacts ---

@SwaggerDeprecated()
@Controller('deprecated-ctrl')
export class DeprecatedController {
  @Get('old')
  oldEndpoint() {
    return 'ok'
  }
}

@Controller('partial-deprecated')
export class PartialDeprecatedController {
  @SwaggerDeprecated()
  @Get('legacy')
  legacyEndpoint() {
    return 'legacy'
  }

  @Get('current')
  currentEndpoint() {
    return 'current'
  }
}

// --- @SwaggerOperationId / @Id artifacts ---

@Controller('op-id')
export class OperationIdController {
  @SwaggerOperationId('listItems')
  @Get('items')
  listItems() {
    return []
  }

  @Id('findItem')
  @Get('items/:id')
  findItem(@Param('id') id: string) {
    return { id }
  }

  @SwaggerOperationId('createItem')
  @Id('createItemId')
  @Get('override')
  overrideHandler() {
    return 'ok'
  }

  @Get('auto')
  autoHandler() {
    return 'ok'
  }
}

// --- @SwaggerExternalDocs artifacts ---

@Controller('ext-docs')
export class ExternalDocsController {
  @SwaggerExternalDocs('https://example.com/docs/list', 'Full list documentation')
  @Get('with-description')
  withDescription() {
    return 'ok'
  }

  @SwaggerExternalDocs('https://example.com/docs/item')
  @Get('url-only')
  urlOnly() {
    return 'ok'
  }

  @Get('none')
  noExternalDocs() {
    return 'ok'
  }
}

// --- discriminator artifacts ---

class CatOrDog {
  static toJsonSchema() {
    return {
      oneOf: [{ $ref: '#/$defs/Dog' }, { $ref: '#/$defs/Cat' }],
      discriminator: {
        propertyName: 'petType',
        mapping: {
          dog: '#/$defs/Dog',
          cat: '#/$defs/Cat',
        },
      },
      $defs: {
        Dog: {
          type: 'object',
          properties: {
            petType: { const: 'dog', type: 'string' },
            name: { type: 'string' },
            isHunt: { type: 'boolean' },
          },
          required: ['petType', 'name', 'isHunt'],
        },
        Cat: {
          type: 'object',
          properties: {
            petType: { const: 'cat', type: 'string' },
            name: { type: 'string' },
          },
          required: ['petType', 'name'],
        },
      },
    }
  }
}

class CatOrDogList {
  static toJsonSchema() {
    return {
      type: 'array',
      items: {
        oneOf: [{ $ref: '#/$defs/Dog' }, { $ref: '#/$defs/Cat' }],
        discriminator: {
          propertyName: 'petType',
          mapping: {
            dog: '#/$defs/Dog',
            cat: '#/$defs/Cat',
          },
        },
      },
      $defs: {
        Dog: {
          type: 'object',
          properties: {
            petType: { const: 'dog', type: 'string' },
            name: { type: 'string' },
            isHunt: { type: 'boolean' },
          },
          required: ['petType', 'name', 'isHunt'],
        },
        Cat: {
          type: 'object',
          properties: {
            petType: { const: 'cat', type: 'string' },
            name: { type: 'string' },
          },
          required: ['petType', 'name'],
        },
      },
    }
  }
}

@Controller('discriminator')
export class DiscriminatorController {
  @Get('pet')
  @SwaggerResponse(200, CatOrDog)
  getPet() {
    return {}
  }

  @Get('pets')
  @SwaggerResponse(200, CatOrDogList)
  getPets() {
    return []
  }
}

// --- @SwaggerLink artifacts ---

@Controller('link-opid')
export class LinkByOperationIdController {
  @SwaggerLink('GetUser', {
    operationId: 'getUser',
    parameters: { userId: '$response.body#/id' },
    description: 'Get the created user',
  })
  @SwaggerResponse(201, { response: { type: 'object', properties: { id: { type: 'string' } } } })
  @Post('users')
  createUser() {
    return { id: '123' }
  }

  @SwaggerOperationId('getUser')
  @Get('users/:id')
  getUser(@Param('id') id: string) {
    return { id }
  }
}

@Controller('link-ref')
export class LinkByHandlerRefController {
  @SwaggerLink('GetItem', {
    handler: [LinkByHandlerRefController, 'getItem'],
    parameters: { itemId: '$response.body#/itemId' },
  })
  @SwaggerResponse(201, {
    response: { type: 'object', properties: { itemId: { type: 'string' } } },
  })
  @Post('items')
  createItem() {
    return { itemId: '456' }
  }

  @SwaggerOperationId('getItemById')
  @Get('items/:id')
  getItem(@Param('id') id: string) {
    return { id }
  }
}

@Controller('multi-link')
export class MultiLinkController {
  @SwaggerLink('GetUser', {
    operationId: 'getUser',
    parameters: { userId: '$response.body#/id' },
  })
  @SwaggerLink('ListUserOrders', {
    operationId: 'listOrders',
    parameters: { userId: '$response.body#/id' },
  })
  @SwaggerResponse(201, { response: { type: 'object', properties: { id: { type: 'string' } } } })
  @Post('users')
  createUser() {
    return { id: '123' }
  }
}

// --- @SwaggerCallback artifacts ---

class EventPayload {
  static toJsonSchema() {
    return {
      type: 'object',
      properties: {
        event: { type: 'string' },
        data: { type: 'object' },
      },
      required: ['event'],
    }
  }
}

@Controller('callback-basic')
export class CallbackBasicController {
  @SwaggerCallback('onEvent', {
    expression: '{$request.body#/callbackUrl}',
    requestBody: EventPayload,
    description: 'Event notification sent to subscriber',
  })
  @Post('subscribe')
  subscribe() {
    return 'ok'
  }
}

@Controller('callback-custom')
export class CallbackCustomController {
  @SwaggerCallback('onStatus', {
    expression: '{$request.body#/hookUrl}',
    method: 'put',
    contentType: 'text/plain',
    requestBody: { type: 'string' },
    responseStatus: 204,
    responseDescription: 'Acknowledged',
  })
  @Post('register')
  register() {
    return 'ok'
  }
}

@Controller('callback-multi')
export class CallbackMultiController {
  @SwaggerCallback('onCreate', {
    expression: '{$request.body#/callbackUrl}',
    requestBody: { type: 'object', properties: { id: { type: 'string' } } },
  })
  @SwaggerCallback('onDelete', {
    expression: '{$request.body#/callbackUrl}',
    requestBody: {
      type: 'object',
      properties: { id: { type: 'string' }, deleted: { type: 'boolean' } },
    },
  })
  @Post('watch')
  watch() {
    return 'ok'
  }
}

@Controller('link-status')
export class LinkStatusCodeController {
  @SwaggerLink(201, 'GetCreated', {
    operationId: 'getCreated',
    parameters: { id: '$response.body#/id' },
  })
  @SwaggerLink(200, 'GetUpdated', {
    operationId: 'getUpdated',
    parameters: { id: '$response.body#/id' },
  })
  @SwaggerResponse(201, { response: { type: 'object', properties: { id: { type: 'string' } } } })
  @SwaggerResponse(200, { response: { type: 'object', properties: { id: { type: 'string' } } } })
  @Post('upsert')
  upsert() {
    return { id: '789' }
  }
}
