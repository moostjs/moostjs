# Introduction to Moost Pipelines

Moost’s pipeline system provides a structured, extensible way to process data before it reaches your handlers or event-scoped classes. Pipelines consist of one or more “pipes” — functions that transform, validate, or resolve values. By organizing these operations into discrete steps, you can maintain cleaner code, reduce boilerplate, and ensure consistent data handling throughout your application.

## What Are Pipelines?

Pipelines are an ordered sequence of pipes executed against values as they travel through Moost’s runtime. For example, when a handler is invoked, Moost retrieves and processes its arguments through a pipeline, ensuring parameters are properly resolved and validated before the handler runs.

Typical operations include:

- **Resolving Data:** Extracting route parameters, parsing request bodies, or injecting dependencies.
- **Transforming Data:** Converting data formats (e.g., strings to numbers), trimming strings, or normalizing data structures.
- **Validating Data:** Ensuring the data meets certain criteria (for example, validating input with Atscript-based schemas).

Each pipe is assigned a priority (e.g., `RESOLVE`, `TRANSFORM`, `VALIDATE`), allowing Moost to run them in a logical order. Pipes also run in other contexts — such as during class instantiation for dependency injection, ensuring consistent data shaping throughout your application.

## When and Where Do Pipes Run?

Moost pipelines operate at various stages:

1. **Handler Argument Resolution:**  
   Before calling your handler method, Moost runs a pipeline on each parameter. For instance, route parameters, request bodies, or query parameters pass through the `RESOLVE` pipe (and possibly others) before reaching the handler. This ensures your handler receives clean, well-structured arguments.

2. **Class Properties and DI Instantiation:**  
   For event-scoped classes (e.g., controllers with `FOR_EVENT` scope), pipes can also run when creating class instances and injecting constructor parameters or properties. This allows pipelines to enforce consistent data validation and transformation even at the construction level.

3. **Global and Local Configuration:**  
   Pipes can be applied globally — affecting all handlers and classes — or selectively at the controller, method, parameter, or property level. This granular control lets you decide when and where certain transformations or validations should occur.

## The Resolve Pipe

Moost includes a default **resolve pipe** that’s always enabled. This pipe handles data extraction (e.g., `@Param` decorators) and ensures arguments are properly resolved before your handler runs. You don’t need to configure this pipe — it just works out of the box.

## Enabling Other Pipes

You can integrate additional pipes, such as validation provided by `@atscript/moost-validator`. The Atscript integration reuses the `validator()` factory emitted by Atscript models so your handlers receive fully validated DTOs without manual checks.

- **`applyGlobalPipes` Method:** Add pipes globally to all parameters or properties. For example, registering a validation pipe at the global level ensures every parameter is validated by default.
- **`@Pipe` Decorator:** Attach a pipe at the class, method, or parameter level. This approach lets you apply transformations or validations selectively, enabling fine-grained control over your data processing pipeline.

**Example of `applyGlobalPipes`**
```ts
import { Moost } from 'moost'
import { validatorPipe } from '@atscript/moost-validator'

const app = new Moost()
// ...
app.applyGlobalPipes(validatorPipe())
```

**Simplified Example `@Pipe`:**
```ts
import { UseValidatorPipe } from '@atscript/moost-validator'

@UseValidatorPipe() // Apply the pipe at the class level
class MyController {
  myMethod(@Param('data') data: DTOClass) {
    // `data` will be validated by the Atscript pipe before myMethod is called
  }
}
```

## Custom Pipes

If Moost’s built-in pipes and external integrations don’t meet your needs, you can write custom pipes with `definePipeFn()`. This function allows you to define logic that runs at a specific priority and can transform, validate, or resolve values in any manner you choose.

For example, you might create a custom pipe to:
- Convert all string inputs to lowercase.
- Strip HTML tags from user-generated content.
- Perform custom authorization checks before the handler executes.

We’ll cover writing custom pipes in more detail in a dedicated guide.
