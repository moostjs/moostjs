import { Body, Get, Post, Query } from '@moostjs/event-http'
import { Controller, Optional, Param } from '@moostjs/moost'
import { IsArray, IsNullable, IsNumber, IsString, MatchesRegex, Max, Min, ToNumber } from '@moostjs/zod'
import { SwaggerRequestBody, SwaggerResponse } from '../decorators'

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
    testQuerySingle(@IsString().optional() @Query('foo') foo: string, @IsNumber() @Max(100) @ToNumber() @Optional() @Query('bar') bar: number) {
        return { foo, bar }
    }

    @Get('test-response/:name')
    @SwaggerResponse(SwaggerTypeTest)
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
}
