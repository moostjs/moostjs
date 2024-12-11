# Validation Pipe in Moost

With Moost’s validation pipe, powered by [Zod](https://zod.dev/), you can define data schemas and enforce them through decorators rather than writing validation logic manually. Instead of inline validation checks or separate schema files, Moost allows you to annotate your classes (DTOs) and parameters directly with Zod-based decorators, turning validation into a declarative, easy-to-manage process.

*New to Moost Pipelines? Read the [Introduction to Moost Pipelines](/moost/pipes/) to learn more about Moost’s pipeline system.*

## How It Works

1. **DTO Classes with `@Validatable()`:**  
   You first create a Data Transfer Object (DTO) class and mark it as `@Validatable()` to indicate that Moost should run it through the Zod validation pipe.

2. **Zod Decorators on Properties:**  
   Decorators like `@IsString()`, `@IsEmail()`, or `@Min()` (among many others) let you declare Zod schemas at the property level. These decorators transform your class definition into a Zod schema.

3. **Applying the Zod Pipeline:**  
   Once your DTO is annotated and `@Validatable()` is set, the Zod pipeline is triggered during the Resolve and Validation Pipe stages. Any incoming data that maps to these DTOs (e.g., request bodies, parameters) gets validated automatically. Invalid data raises a Zod error before your handler executes.

## Example

Suppose you’re building an endpoint to create a new user. You can define a DTO class as follows:

```ts
import { Controller, Post, Body } from 'moost'
import { Validatable, IsString, IsEmail, Min } from '@moostjs/zod'

// Mark this class for validation
@Validatable() // [!code hl]
class CreateUserDto { // [!code hl]
  @IsString() // [!code hl]
  @Min(3) // [!code hl]
  username!: string // [!code hl]
 // [!code hl]
  @IsEmail() // [!code hl]
  email!: string // [!code hl]
} // [!code hl]

@Controller('users')
class UserController {
  @Post('create')
  createUser(@Body() data: CreateUserDto) { // [!code hl]
    // If we reach here, 'data' already passed Zod validation
    return `User ${data.username} created with email ${data.email}`
  }
}
```

**What’s happening here?**  
- `@Validatable()` signals that the `CreateUserDto` should be transformed into a Zod schema.
- `@IsString()` and `@IsEmail()` define the required data formats, while `@Min(3)` ensures `username` is at least 3 characters long.
- When you send a POST request to `/users/create`, Moost’s validation pipe checks the request body against this Zod schema. If it’s invalid, you get a clear error before the handler runs.

## Applying the Zod Pipeline

To enable this validation, you need to apply the Zod pipeline to your Moost app (or per controller/method if desired):

```ts
import { Moost } from 'moost'
import { ZodPipeline } from '@moostjs/zod'

const app = new Moost()
app.applyGlobalPipes(ZodPipeline()) // [!code hl]
```

With these steps in place, the validation pipe automatically ensures all decorated DTOs and parameters are checked, improving data consistency, reducing boilerplate, and making error handling more straightforward.

*Read [Enabling Other Pipes](/moost/pipes/#enabling-other-pipes) to learn more ways to apply a pipeline.*

## More About Validations

- [Validations API Reference](/validation/api)