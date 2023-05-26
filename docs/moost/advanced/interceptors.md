# Interceptors

## Content

[[toc]]

## Overview

Interceptors in Moost provide a way to intercept and modify the event context before and after the execution of an event handler.
They can be used for various purposes such as request/response manipulation, authorization, logging, and more.
Interceptors allow you to modify the event context, rewrite the response, or even stop the processing of an event by emitting a response or throwing an error.

## Interceptor Priorities

Interceptor priorities in Moost allow you to define the order in which multiple interceptors are executed.
The `TInterceptorPriority` enum provides a set of priority levels that determine the sequence of interceptor execution.
Interceptors with lower priority values are executed before those with higher priority values.

Here is the list of interceptor priorities in ascending order:

0. `BEFORE_ALL`: Interceptors with this priority level are executed first. Use this priority for interceptors that need to perform initialization or setup tasks.
0. `BEFORE_GUARD`: Interceptors with this priority level are before any guard interceptors.
0. `GUARD`: Use this priority for interceptors that act as guards and perform authorization checks.
0. `AFTER_GUARD`: Interceptors with this priority level are executed right after the guard interceptors.
0. `INTERCEPTOR`: (default) Use this priority for general interceptors that modify the event context or perform additional processing.
0. `CATCH_ERROR`: Interceptors with this priority level are executed right after general purpose interceptors. Use this priority for interceptors that handle and process errors.
0. `AFTER_ALL`: Interceptors with this priority level are executed last. Use this priority for interceptors that need to perform cleanup tasks or finalization steps.

By assigning the appropriate priority to each interceptor, you can control the execution order and ensure that the interceptors are applied in the desired sequence.
This allows you to customize the behavior of your application and apply different interceptors based on specific requirements.

## Creating an Interceptor

To create an interceptor in Moost, you can use the `defineInterceptorFn` function.
This function takes a callback that allows you to define the interceptor logic.
Here's an example of how to create an interceptor:

```ts
import { Intercept, defineInterceptorFn, TInterceptorPriority } from 'moost';

// Define interceptor function
export const myInterceptorFn = defineInterceptorFn((before, after, onError) => {
  // Initialize your interceptor
  before((reply) => {
    // Callback called after the request handler arguments
    // were resolved but before the handler is called

    // The "reply" function allows you emit response and
    // avoid execution of an event handler,
    // e.g., reply('new response')

    // Perform interceptor logic before the handler call
  });

  after((response, reply) => {
    // Callback called after the request handler execution

    // The "response" argument contains the value returned from the request handler
    // The "reply" function allows you to rewrite the response,
    // e.g., reply('new response')

    // Perform interceptor logic after the handler call
  });

  onError((error, reply) => {
    // Callback called after the request handler execution in case of an error

    // The "error" argument contains the error instance
    // The "reply" function allows you to rewrite the response, e.g., reply('new response')

    // Perform interceptor logic after the handler call
  });

  // if you return non-undefined value from the main interceptor function
  // it will be taken as a response and the further event processing
  // will be ignored
  //
  // return 'new response'
}, TInterceptorPriority.INTERCEPTOR);
```
In the above example, the `defineInterceptorFn` function is used to create an interceptor function.

The `before` callback is called before the execution of the handler and receives a `reply` function,
allowing you to perform any necessary logic and cut the processing of event emitting a new response using the `reply` function.

The `after` callback is called after the handler execution and receives the `response` value and a `reply` function,
which can be used to modify the response.

The `onError` callback is called if an error occurs during the handler execution.
It also receives the `error` instance and the `reply` function.

## Using Interceptors

Once you have defined an interceptor function, you can apply it to event handlers or controller classes by using the interceptor decorator.

Here's an example:
```ts
import { myInterceptorFn } from './path/to/interceptors';
import { Controller, Get, Intercept } from 'moost';

@Intercept(myInterceptorFn) // Apply to all the handlers in class // [!code hl]
@Controller()
export class ExampleController {
  @Get('test')
  @Intercept(myInterceptorFn) // Apply to testHandler only // [!code hl]
  testHandler() {
    // ...
  }
}
```

Alternatively you can define a new Decorator based on your interceptor fn

```ts
// Define interceptor decorator
export const MyInterceptorDecorator = Intercept(myInterceptorFn);
```

The `MyInterceptorDecorator` is a decorator now, it can be applied to our handlers.
Here's an example:
```ts
import { myInterceptorFn } from './path/to/interceptors';
import { Controller, Get, Intercept } from 'moost';

const MyInterceptorDecorator = Intercept(myInterceptorFn); // [!code ++]

@Intercept(myInterceptorFn) // Apply to all the handlers in class // [!code --]
@MyInterceptorDecorator     // Apply to all the handlers in class // [!code ++]
@Controller()
export class ExampleController {
  @Get('test')
  @Intercept(myInterceptorFn) // Apply to testHandler only // [!code --]
  @MyInterceptorDecorator     // Apply to testHandler only // [!code ++]
  testHandler() {
    // ...
  }
}
```

## Global Interceptors

Moost provides the capability to apply interceptors globally,
which affects the execution of all controllers and event handlers in your application.
To apply an interceptor globally, you can use the `applyGlobalInterceptors` method of a Moost instance.
This method allows you to specify the interceptor function that will be applied to all the event handlers.

Here's an example of how to apply a global interceptor:

```ts
import { myInterceptorFn } from './path/to/interceptors';
import { Moost } from 'moost';

const app = new Moost();
app.applyGlobalInterceptors(myInterceptorFn);
```
By applying a global interceptor, you can add common functionality or behavior that should be
executed for every event, such as logging, authentication, error handling, event preprocessing, or event postprocessing.

## Class-based Interceptors

Moost also supports class-based interceptors, which offer the advantage of leveraging dependency injection.
When using a class-based interceptor, Moost takes care of creating an instance of the interceptor
class and injecting any required dependencies into its constructor.

Class-based interceptors can be scoped `FOR_EVENT`, which means they will have a new instance for each event
and can benefit from resolvers defined on class properties.

Here's an example of defining a class-based interceptor:

```ts
import { TClassFunction, TInterceptorFn, Intercept, TInterceptorPriority, Injectable } from 'moost';

// Define a class-based interceptor
@Injectable()
class MyInterceptorClass implements TClassFunction<TInterceptorFn> {
    static priority: TInterceptorPriority = TInterceptorPriority.BEFORE_ALL;

    handler = (before, after, onError) => {
        // Interceptor logic goes here
    };
}

// Transform MyInterceptorClass into a decorator
const MyInterceptor = Intercept(MyInterceptorClass);
```
In the above example, `MyInterceptorClass` is defined as a class-based interceptor by implementing
the `TClassFunction<TInterceptorFn>` interface.
The handler method within the class represents the interceptor logic that will be executed.
The `priority` property is used to determine the order of execution among other interceptors.

By transforming `MyInterceptorClass` into a decorator using the `Intercept` function,
you can easily apply the interceptor to your controllers or event handlers by decorating them with `@MyInterceptor`.
The class-based interceptor will then be instantiated by Moost, and its handler method will be called during the interception process.
