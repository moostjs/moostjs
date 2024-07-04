import { Body, Get, Post, Query } from '@moostjs/event-http'
import {
  IsArray,
  IsNullable,
  IsNumber,
  IsString,
  MatchesRegex,
  Max,
  Min,
  ToNumber,
} from '@moostjs/zod'
import { Controller, Label, Optional, Param } from 'moost'

import { SwaggerExample, SwaggerParam, SwaggerRequestBody, SwaggerResponse } from '../decorators'

@Label('Type Definition')
@SwaggerExample({
  name: 'John',
  age: 54,
  array: ['example'],
})
export class SwaggerTypeTest {
  @Min(10)
  @Max(20)
  @MatchesRegex(/test/)
  name = 'name'

  @Optional()
  @Min(4)
  @Max(55)
  age = 26

  @IsNullable()
  @IsString()
  @IsArray()
  @Min(1)
  @Max(2)
  array: string[] = []
}

@Controller('prefix')
export class SwaggerControllerTest {
  @Get('test-query')
  testQuery(@Query() query: SwaggerTypeTest) {
    return query
  }

  @Get('test-query-single')
  testQuerySingle(
    // prettier-ignore
    @(IsString().optional()) @Query('foo') foo: string,
    @IsNumber() @Max(100) @ToNumber() @Optional() @Query('bar') bar: number
  ) {
    return { foo, bar }
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
  testResponse(@Min(10) @Param('name') name: string) {
    const r = new SwaggerTypeTest()
    r.name = name
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
