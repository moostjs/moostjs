import { Body, Delete, Get, Post, Put, Query } from '@moostjs/event-http'
import { Controller, Description, Label, Optional, Param } from 'moost'

import {
  SwaggerDescription,
  SwaggerExample,
  SwaggerExclude,
  SwaggerParam,
  SwaggerRequestBody,
  SwaggerResponse,
  SwaggerTag,
} from '../decorators'

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
