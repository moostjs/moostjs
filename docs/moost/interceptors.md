# Interceptors in Moost

Interceptors in Moost act as flexible middleware that can modify the request flow before and after your handlers execute. They’re an essential tool for cross-cutting concerns such as logging, authentication, input validation, response transformation, and error handling, without cluttering your controller or handler logic.

## Key Concepts

- **Lifecycle Hooks:** Interceptors run at defined points:
  - **Before Handler:** Modify requests, inject prerequisites, or halt execution.
  - **After Handler:** Transform responses, log results, or finalize cleanup steps.
  - **On Error:** Handle exceptions gracefully, transforming or logging errors.

- **Priority Levels:**  
  Interceptors execute in a defined order based on their priority (`TInterceptorPriority`). Some common priorities:
  - `BEFORE_ALL` (0): Run setup logic before anything else.
  - `GUARD` (2): Authorization checks.
  - `INTERCEPTOR` (4): General-purpose interceptors.
  - `CATCH_ERROR` (5): Error-handling interceptors.
  - `AFTER_ALL` (6): Final cleanup logic at the end.

These priorities ensure you can layer interceptors logically, ensuring authentication runs before business logic, and cleanup runs after everything else.

## Creating Interceptors

You can define interceptors as functions or classes. Both forms integrate with Moost’s DI and event lifecycle.

### Functional Interceptors

Use `defineInterceptorFn` to create a functional interceptor. This function receives three callback registrars: `before`, `after`, and `onError`. Each accepts a function defining what to do at that stage.

**Example:**
```ts
import { defineInterceptorFn, TInterceptorPriority } from 'moost';

export const myInterceptorFn = defineInterceptorFn((before, after, onError) => {
  before((reply) => {
    // Runs before handler
    // For example, log request start time or validate inputs
  });

  after((response, reply) => {
    // Runs after handler returns
    // For example, modify response or log the result
  });

  onError((error, reply) => {
    // Runs if the handler throws an error
    // For example, transform the error into a user-friendly message
  });
}, TInterceptorPriority.INTERCEPTOR);
```

In the above example:
- `before` and `after` functions optionally call `reply(value)` to modify the final response or stop processing further.
- `onError` can also call `reply(value)` to override the error response.

### Class-Based Interceptors

Interceptors can be defined as classes, benefiting from Moost’s DI. This allows you to inject services or configuration into your interceptors. Class-based interceptors must implement a `handler` method that matches the interceptor function signature.

**Example:**
```ts
import { TClassFunction, Injectable, TInterceptorFn, TInterceptorPriority } from 'moost';

@Injectable()
class MyClassInterceptor implements TClassFunction<TInterceptorFn> {
  static priority = TInterceptorPriority.BEFORE_ALL;

  handler: TInterceptorFn = (before, after, onError) => {
    before((reply) => {
      // Set up or modify the request context before the handler
    });
    after((response, reply) => {
      // Post-processing or logging after the handler executes
    });
    onError((error, reply) => {
      // Centralized error handling logic
    });
  };
}
```

**Using the Interceptor:**
```ts
import { Intercept } from 'moost';

const MyClassInterceptorDecorator = Intercept(MyClassInterceptor);

@Controller()
@MyClassInterceptorDecorator
class ExampleController {
  @Get('test')
  testHandler() { /* ... */ }
}
```

In this setup, Moost creates and injects dependencies into the interceptor class, letting you easily integrate services like logging, configuration, or authentication checks.

## Applying Interceptors

Interceptors can be applied at different levels:

1. **Per-Handler:**
   ```ts
   @Get('test')
   @Intercept(myInterceptorFn)
   testHandler() { /* ... */ }
   ```

2. **Per-Controller:**
   ```ts
   @Intercept(myInterceptorFn)
   @Controller()
   class ExampleController {
     @Get('test')
     testHandler() { /* ... */ }
   }
   ```

3. **Globally:**
   ```ts
   const app = new Moost();
   app.applyGlobalInterceptors(myInterceptorFn);
   ```
   
Global interceptors affect all controllers and handlers, making them useful for tasks like global logging, authentication, or rate limiting.

## Practical Use Cases

- **Authentication/Authorization:**
  Run guards at `BEFORE_GUARD` or `GUARD` priority to ensure only authenticated users can reach certain handlers.
  
- **Error Transformation:**
  Use `CATCH_ERROR` priority interceptors to convert technical exceptions into readable error messages for clients.
  
- **Response Shaping:**
  Post-process responses at `AFTER_ALL` to add common headers, wrap data in a standard envelope, or ensure consistent formatting across all endpoints.
  
- **Performance Logging:**
  `BEFORE_ALL` or `AFTER_ALL` interceptors can record timestamps, measure handler execution time, and log metrics.

## Best Practices

- **Keep Interceptors Focused:**  
  Each interceptor should handle a specific concern (e.g., logging, auth, formatting). This modularity improves maintainability.
  
- **Leverage Priorities:**  
  Assign meaningful priorities so interceptors execute in a logical sequence. For example, run authorization checks before general logging.
  
- **Combine with DI:**  
  Class-based interceptors can use DI to access services, configurations, or cached data, keeping the interceptor code minimal and testable.

---

Interceptors bring flexibility and control to your Moost application’s event flow. By understanding their lifecycle, priorities, and integration with DI, you can implement sophisticated cross-cutting logic without polluting your business code.
