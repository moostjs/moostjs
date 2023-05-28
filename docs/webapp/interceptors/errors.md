# Error Handler

## Overview

Error interceptors in Moost are specialized interceptors that handle errors occurring during the HTTP request processing workflow. These interceptors can customize the error response sent back to the client.

This section illustrates how to create an error interceptor, and provides an example of how to apply this interceptor to your application.

## Creating an Error Interceptor

Error interceptors are created in a similar way to other interceptors, but with a focus on handling errors. They primarily utilize the `onError` hook provided in the interceptor function definition.

Let's create an interceptor that formats our errors in a specific way before sending the response to the client:

```ts
import { defineInterceptorFn, TInterceptorPriority } from 'moost';
import { useResponse } from '@wooksjs/event-http';

const errorInterceptor = defineInterceptorFn((before, after, onError) => {
    const { status } = useResponse()
    onError((error, reply) => {
        // You can format the error object here and reply with it
        const formattedError = {
            message: error.message,
            details: '...',
            // additional fields...
        };
        status(418) // Define response status
        reply(formattedError);
    });
}, TInterceptorPriority.CATCH_ERROR);
```

In the example above, we define an interceptor using `defineInterceptorFn`. We specify the `onError` hook and provide a function that formats the error and replies with the newly formatted error. We also set the interceptor priority to `CATCH_ERROR`, which means this interceptor will be executed after general purpose interceptors, right before the response is sent to the client.

## Applying the Error Interceptor

To apply this interceptor to your application, you can use the `@Intercept` decorator. You can apply it at a controller level, or at an individual handler level.

Here's an example:

```ts
import { errorInterceptor } from './path/to/interceptors';
import { Controller, Get, Intercept } from 'moost';

@Intercept(errorInterceptor) // Apply to all the handlers in class
@Controller()
export class ExampleController {
  @Intercept(errorInterceptorFn) // Apply to testHandler only
  @Get('test')
  testHandler() {
    // Your handler logic
  }
}
```

In this example, we apply the `errorInterceptor` to all handlers in the `ExampleController` class. This means that if an error is raised in any handler in this class, it will be caught by the `errorInterceptor`, and a custom error response will be sent to the client.

## Error Interceptor Decorator

For convenience, you might want to convert your interceptor into a decorator. Here's how you can do it:

```ts
import { defineInterceptorFn, Intercept, TInterceptorPriority } from 'moost';
import { useResponse } from '@wooksjs/event-http';

const errorInterceptorFn = defineInterceptorFn((before, after, onError) => {
    const { status } = useResponse()
    onError((error, reply) => {
        const formattedError = {
            message: error.message,
            details: '...',
            // additional fields...
        };
        status(418) // Define response status
        reply(formattedError);
    });
}, TInterceptorPriority.CATCH_ERROR);

export const ErrorInterceptor = Intercept(errorInterceptorFn); //[!code ++]
```

Now `ErrorInterceptor` is a decorator and can be applied to your handlers or controllers as shown below:

```ts
import { ErrorInterceptor } from './path/to/interceptors';
import { Controller, Get } from 'moost';

@Controller()
@Intercept(errorInterceptor) // Apply to all the handlers in class //[!code --]
@ErrorInterceptor // Apply to all the handlers in class  //[!code ++]
export class ExampleController {
  @Intercept(errorInterceptorFn) // Apply to testHandler only //[!code --]
  @ErrorInterceptor // Apply to testHandler only         //[!code ++]
  @Get('test')
  testHandler() {
    // Your handler logic
  }
}
```

This pattern allows for cleaner code and improved reusability. Each time you want to apply your error interceptor, you can simply use the `@ErrorInterceptor` decorator.
