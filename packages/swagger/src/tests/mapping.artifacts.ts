import { Body, Get, Post, Query } from '@moostjs/event-http'
import { Controller, Label, Optional, Param } from 'moost'

import { SwaggerExample, SwaggerParam, SwaggerRequestBody, SwaggerResponse } from '../decorators'

@Label('Type Definition')
@SwaggerExample({
  name: 'John',
  age: 54,
  array: ['example'],
})
export class SwaggerTypeTest {
  name = 'name'
  age = 26
  array: Array<string | null> = []

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
