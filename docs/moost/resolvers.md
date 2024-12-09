# Resolvers in Moost

Resolvers are decorators that extract or compute values before a handler executes, injecting data into handler parameters or class properties (in `FOR_EVENT`-scoped controllers). By using resolvers, you avoid manual data extraction or transformation logic inside your handlers, resulting in cleaner, more testable code.

## What Are Resolvers?

Resolvers are essentially a pipeline stage that runs before your handler’s logic. They:

- Pull values from external sources (e.g., route parameters).
- Compute data on the fly (e.g., generate timestamps or retrieve a logger).
- Populate arguments or event-scoped class properties with ready-to-use values.

Moost comes with several built-in resolvers, such as `@Param`, `@Params`, `@Const`, `@ConstFactory`, and `@InjectEventLogger`. You can also create your own custom resolvers to handle application-specific data retrieval tasks.

**Why use resolvers?**  
They help maintain consistent, declarative data retrieval patterns across your application. Instead of manually extracting query parameters, route params, or computing values, you decorate your handler arguments or properties, and Moost does the rest.

## Built-In Resolvers

- **`@Param('name')`**: Extracts a specific route parameter named `name`.
- **`@Params()`**: Injects an object containing all route parameters.
- **`@Const(value)`**: Supplies a constant value as an argument or property.
- **`@ConstFactory(() => value)`**: Runs a factory function at call-time to produce a value for the argument or property.
- **`@InjectEventLogger(topic?)`**: Provides an Event Logger instance, optionally scoped by `topic`.

**Example:**
```ts
import { Controller, Param, Get } from 'moost';

@Controller('api')
class MyController {
  @Get('users/:id')
  getUser(@Param('id') userId: string) {
    // userId is automatically injected from the route parameter
    return `User ID: ${userId}`;
  }
}
```

In this example, the `@Param('id')` resolver extracts the `:id` parameter from the request path and assigns it to `userId` before `getUser()` is called.

## Creating Custom Resolvers

All resolvers in Moost are built on top of the `@Resolve` decorator. This base decorator takes a callback function that returns the desired value. You can compose additional logic around it to tailor resolvers to your needs.

**Example:**
```ts
import { Controller, Get } from 'moost';
import { Resolve } from 'moost'; // Base resolver from which others are built

function CurrentDate() {
  return Resolve(() => new Date().toISOString());
}

@Controller()
class MyController {
  @Get()
  getTimestamp(@CurrentDate() date: string) {
    return `Current date/time: ${date}`;
  }
}
```

Here, `CurrentDate()` defines a custom resolver that supplies the current timestamp as a string. This pattern makes it trivial to implement application-specific logic, such as fetching configuration values or computing derived fields.

## Testing and Development Benefits

Resolvers integrate seamlessly with Moost’s DI and event-driven architecture. When unit testing your handlers:

- Resolvers are skipped if you directly instantiate and call the handler’s methods, allowing you to inject mock or prepared data directly into handler arguments. This isolation keeps your tests focused and predictable.
- You can confirm that your logic behaves correctly without worrying about how data is extracted or transformed at runtime.

## Resolver Pipeline

By default, Moost runs a resolver pipeline before invoking handlers. This pipeline executes all attached resolvers in a defined order, ensuring all necessary data is available when your handler runs. You can rely on Moost’s built-in lifecycle and pipeline without needing special configuration.

## Best Practices

- **Use Resolvers Consistently:**  
  Apply resolvers to keep argument extraction logic uniform. This fosters a standard pattern across your codebase, making it easier for new team members to understand data flows.
  
- **Refactor Common Logic into Resolvers:**  
  If you find yourself frequently computing the same values for different handlers, encapsulate that logic in a custom resolver. This avoids code duplication and centralizes logic.

- **Combine with `FOR_EVENT` Scopes:**  
  When working with per-event controllers, resolvers can populate class properties, enabling stateful logic tied to a single request or event without cluttering your handler code.

---

Resolvers help streamline data injection and parameter handling in Moost. By leveraging the built-in resolvers or writing your own, you create cleaner, more maintainable code and reduce the overhead of repetitive data extraction tasks.

