# Validation

Moost uses [Atscript](https://atscript.moost.org/) for request validation. Atscript extends TypeScript with annotations that produce runtime validators from your types — no `class-validator`, no duplicate schemas, one source of truth for types and validation rules.

::: tip Atscript documentation
For installation, compiler setup, annotation syntax, and all available options see the [Atscript docs](https://atscript.moost.org/) and the [`@atscript/moost-validator` package reference](https://atscript.moost.org/packages/moost-validator/).
:::

## Quick example

### 1. Define a DTO in Atscript

```atscript
// create-user.as

export interface CreateUserDto {
  @expect.minLength 2
  @expect.maxLength 100
  name: string

  email: string.email

  @meta.sensitive
  @expect.minLength 8
  password: string

  role?: 'admin' | 'user'
}
```

Atscript compiles this to a regular TypeScript module that also carries runtime metadata — validators, labels, constraints — all inferred from the annotations.

### 2. Use it in a handler

```ts
import { Controller } from 'moost'
import { Post, Body } from '@moostjs/event-http'
import {
  UseValidatorPipe,
  UseValidationErrorTransform,
} from '@atscript/moost-validator'
import type { CreateUserDto } from './create-user.as'

@UseValidatorPipe()
@UseValidationErrorTransform()
@Controller('users')
export class UsersController {
  @Post()
  create(@Body() dto: CreateUserDto) {
    // dto is validated — name, email, password all satisfy the Atscript schema
    return { created: dto.name }
  }
}
```

That's it. When a request arrives with an invalid body, the validator pipe rejects it before your handler runs and returns a structured `400` response:

```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "errors": [
    { "path": "email", "message": "Must be a valid email" },
    { "path": "password", "message": "Length must be >= 8" }
  ]
}
```

## Enabling validation globally

Instead of decorating each controller, register the pipe and interceptor once on the app:

```ts
import { Moost } from 'moost'
import { MoostHttp } from '@moostjs/event-http'
import { validatorPipe, validationErrorTransform } from '@atscript/moost-validator'

const app = new Moost()
app.adapter(new MoostHttp())
app.applyGlobalPipes(validatorPipe())
app.applyGlobalInterceptors(validationErrorTransform())
// register controllers...
await app.init()
```

Now every handler parameter whose type was compiled by Atscript is validated automatically.

## Validator options

`validatorPipe(opts)` accepts any subset of Atscript's `TValidatorOptions`. For instance, to allow unknown properties and collect multiple errors:

```ts
app.applyGlobalPipes(
  validatorPipe({
    unknwonProps: 'ignore',
    errorLimit: 50,
  }),
)
```

## Why Atscript

| Approach | Schemas | Validation rules | Runtime cost |
|---|---|---|---|
| **class-validator + class-transformer** | Duplicate class + decorators | Imperative decorators | Reflection + transform |
| **Zod / Yup** | Separate schema object | Builder API | Schema parse |
| **Atscript** | Your TypeScript types *are* the schema | Annotations in the type file | Compiled validators |

Atscript eliminates the gap between the type you write and the validation that runs. One `.as` file produces the TypeScript type, the JSON Schema (for Swagger), and the runtime validator.

## Further reading

- [Atscript documentation](https://atscript.moost.org/) — language reference, CLI, IDE support
- [`@atscript/moost-validator`](https://atscript.moost.org/packages/moost-validator/) — pipe and interceptor API
- [Validation pipe deep dive](/moost/pipes/validate) — priority ordering, per-parameter config, non-HTTP usage
- [Custom resolvers & pipes](/webapp/resolvers) — writing your own transform and validation pipes
