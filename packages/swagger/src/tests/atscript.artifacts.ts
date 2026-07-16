import { Body, Get, Post, Query } from '@moostjs/event-http'
import { Controller, Param } from 'moost'

/**
 * Fake atscript annotated types — structural stand-ins for what
 * `@atscript/typescript` codegen emits (truthy `__is_atscript_annotated_type`
 * marker + `static toJsonSchema()`). Intentionally NO `@atscript/*` imports:
 * atscript depends on moost, so importing it from swagger would be circular.
 */
export class AtscriptDto {
  static __is_atscript_annotated_type = true
  // annotated types carry a runtime type-def under `type` — irrelevant here,
  // present to keep the fixture structurally honest
  static type = { kind: 'object' }
  static metadata = new Map<string, unknown>()

  static toJsonSchema() {
    return {
      type: 'object',
      properties: {
        name: { type: 'string' },
        age: { type: 'number' },
      },
      required: ['name'],
    }
  }
}

/** Annotated type from a project WITHOUT `emit.jsonSchema` — the stub throws. */
export class AtscriptThrowingDto {
  static __is_atscript_annotated_type = true

  static toJsonSchema(): unknown {
    throw new Error(
      'JSON Schema is not enabled. Use "jsonSchema" plugin option or "emit.jsonSchema" annotation.',
    )
  }
}

/** Annotated type whose schema carries nested `$defs` (hoistDefs must apply). */
export class AtscriptNestedDto {
  static __is_atscript_annotated_type = true

  static toJsonSchema() {
    return {
      type: 'object',
      properties: {
        address: { $ref: '#/$defs/AtsAddress' },
      },
      $defs: {
        AtsAddress: {
          type: 'object',
          properties: {
            street: { type: 'string' },
          },
        },
      },
    }
  }
}

/** Plain class — no marker, no toJsonSchema. Pins the legacy fallback path. */
export class PlainDto {
  name = ''
}

/** Non-annotated class with a THROWING toJsonSchema — errors must propagate as before. */
export class LegacyThrowingDto {
  static toJsonSchema(): unknown {
    throw new Error('legacy toJsonSchema throw')
  }
}

@Controller('atscript')
export class AtscriptController {
  @Post('body')
  postBody(@Body() body: AtscriptDto) {
    return body
  }

  @Get('param/:id')
  getParam(@Param('id') id: AtscriptDto) {
    return id
  }

  @Get('query')
  getQuery(@Query() query: AtscriptDto) {
    return query
  }

  @Post('throwing')
  postThrowing(@Body() body: AtscriptThrowingDto) {
    return body
  }

  @Post('throwing-2')
  postThrowing2(@Body() body: AtscriptThrowingDto) {
    return body
  }

  @Get('throwing-param/:id')
  getThrowingParam(@Param('id') id: AtscriptThrowingDto) {
    return id
  }

  @Post('nested')
  postNested(@Body() body: AtscriptNestedDto) {
    return body
  }

  @Post('plain')
  postPlain(@Body() body: PlainDto) {
    return body
  }

  @Get('plain-param/:name')
  getPlainParam(@Param('name') name: PlainDto) {
    return name
  }
}

@Controller('legacy-throwing')
export class LegacyThrowingController {
  @Post('body')
  postBody(@Body() body: LegacyThrowingDto) {
    return body
  }
}
