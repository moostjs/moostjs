# Resolve Pipe in Moost

The **Resolve Pipe** in Moost is responsible for extracting and preparing the data your handlers and event-scoped classes need — without requiring you to write boilerplate parsing or data-fetching code. This pipeline runs automatically before a handler is invoked and leverages "resolvers" — decorators that declare how to retrieve or compute values for handler parameters or class properties.

## What Is the Resolve Pipe?

The Resolve Pipe is always active in Moost, ensuring that each handler argument is fully prepared before the handler method runs. At its core, it transforms abstract instructions (like "this parameter should be the `:id` route parameter" or "this property should be the current date") into concrete values. By the time your handler executes, all arguments are properly resolved, and the handler can focus purely on application logic.

## How Resolvers Work

Resolvers are decorators that you apply directly to parameters or properties. They define a small function that fetches or computes a value at runtime. For instance:

- **`@Param('name')`**: Extracts a route parameter named `name`.
- **`@Params()`**: Injects an object of all route parameters.
- **`@Const(value)`** and **`@ConstFactory()`**: Provide fixed or dynamically computed constants.
- **`@InjectEventLogger()`**: Supplies an event-aware logger instance.
- Other resolvers are provided by event-specific modules, e.g. resolver `@Body()` that parses body of incoming HTTP request is provided by `@moostjs/event-http` module.

At the Resolve Pipe stage, Moost reads a resolver function defined for a given parameter or property and executes it.

**Example:**
```ts
import { Controller, Param, Get } from 'moost';

@Controller('api')
class MyController {
  @Get('users/:id')
  getUser(@Param('id') userId: string) { // [!code hl]
    // `userId` is automatically resolved from the route parameter
    return `User ID: ${userId}`;
  }
}
```

In this example, the `@Param('id')` resolver runs during the Resolve Pipe and supplies the `userId` argument before `getUser()` is called.

## The `@Resolve` Decorator for Custom Resolvers

Moost provides a `@Resolve` decorator, the foundational API for building custom resolvers. All built-in resolvers like `@Param` or `@InjectEventLogger` are constructed using `@Resolve`. This empowers you to create your own resolvers for any data retrieval logic unique to your application.

**Example:**
```ts
import { Controller, Get } from 'moost';
import { Resolve } from 'moost'; // Base decorator for custom resolvers

function CurrentDate() { // [!code hl]
  return Resolve(() => new Date().toISOString()); // [!code hl]
} // [!code hl]

@Controller()
class MyController {
  @Get()
  getTimestamp(@CurrentDate() date: string) { // [!code hl]
    return `Current date/time: ${date}`;
  }
}
```

Here, `CurrentDate()` uses `@Resolve` to provide the current timestamp. Moost calls the resolver function during the Resolve Pipe, injecting the computed value into the `date` parameter.

## Integration with Event Context and DI

Resolvers integrate seamlessly with Moost’s event context and dependency injection (DI):

- **Event Context Access:** Since Moost is built on Wooks, resolvers can access the event context (e.g., request data) through composables. For example, `@Param` resolvers use Wooks utilities to fetch route parameters.
- **Dependency Injection:** If needed, resolvers can also leverage DI to retrieve services or configuration. For example, you could write a custom resolver that injects a configuration service and computes a value based on that service’s data.

## When Do Resolvers Run?

- **Handler Arguments:** Before your handler executes, Moost runs the Resolve Pipe on each argument. Each resolver runs, producing final argument values.
- **Injected Classes (Properties and Constructor Arguments):** Resolve Pipe also run for injected classes constructor parameters and properties. This ensures each event-scoped instance is fully prepared with resolved data from the get-go.
