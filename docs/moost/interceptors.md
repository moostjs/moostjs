# Interceptors

## Quick Summary

Moost's interceptors let you modify the event context both before and after an event handler runs. They're versatile, with uses ranging from manipulating requests or responses, authorizing actions, logging events, and more. They can adjust the response, halt event processing, or deal with errors.

## Interceptor Priorities

Interceptor priorities manage the order interceptors are activated. `TInterceptorPriority` enum sets these levels, with lower priority interceptors going first. They follow this sequence:

0. `BEFORE_ALL`: First to go, used for initial setup.
1. `BEFORE_GUARD`: Executed before any guard interceptors.
2. `GUARD`: For authorization checking interceptors.
3. `AFTER_GUARD`: Executed after the guard interceptors.
4. `INTERCEPTOR`: Default priority for common interceptors.
5. `CATCH_ERROR`: Post-execution interceptors dealing with errors.
6. `AFTER_ALL`: Last to go, used for cleanup or final actions.

## Creating an Interceptor

You can craft an interceptor with the `defineInterceptorFn` function, where you detail the interceptor's logic. Here's an example:

```ts
import { Intercept, defineInterceptorFn, TInterceptorPriority } from 'moost';

export const myInterceptorFn = defineInterceptorFn((before, after, onError) => {
  before((reply) => {
    // Pre-handler execution logic
  });

  after((response, reply) => {
    // Post-handler execution logic
  });

  onError((error, reply) => {
    // Error handling logic
  });
}, TInterceptorPriority.INTERCEPTOR);
```

In this example, `before`, `after`, and `onError` callbacks manage actions before, after, and in the event of handler errors, respectively. `reply` can be used to modify responses or halt processing.

## Applying Interceptors

After creating an interceptor function, apply it to event handlers or controller classes using the `@Intercept` decorator:

```ts
import { myInterceptorFn } from './path/to/interceptors';
import { Controller, Intercept } from 'moost';
import { Get } from '@moostjs/event-http';

@Intercept(myInterceptorFn)
@Controller()
export class ExampleController {
  @Get('test')
  @Intercept(myInterceptorFn)
  testHandler() {
    // ...
  }
}
```

Alternatively, define a new Decorator based on your interceptor function:

```ts
const MyInterceptorDecorator = Intercept(myInterceptorFn);

@MyInterceptorDecorator
@Controller()
export class ExampleController {
  @Get('test')
  @MyInterceptorDecorator
  testHandler() {
    // ...
  }
}
```

## Global Interceptors

Use Moost's `applyGlobalInterceptors` method to apply interceptors universally across all controllers and handlers in your application:

```ts
import { myInterceptorFn } from './path/to/interceptors';
import { Moost } from 'moost';

const app = new Moost();
app.applyGlobalInterceptors(myInterceptorFn);
```

Global interceptors can apply common features like logging, authentication, or event handling across all events.

## Class-based Interceptors

Moost supports class-based interceptors, benefiting from dependency injection.
Moost will create an instance of the interceptor class and inject dependencies. These interceptors can have `FOR_EVENT` scope, allowing resolvers on class properties. 

Here's an example:

```ts
import { TClassFunction, TInterceptorFn, Intercept, TInterceptorPriority, Injectable } from 'moost';

@Injectable()
class MyInterceptorClass implements TClassFunction<TInterceptorFn> {
    static priority: TInterceptorPriority = TInterceptorPriority.BEFORE_ALL;

    handler = (before, after, onError

) => {
        // Interceptor logic here
    };
}

const MyInterceptor = Intercept(MyInterceptorClass);
```

In this example, `MyInterceptorClass` defines a class-based interceptor, with a `handler` method for the interceptor's
logic and a `priority` for its execution order. Using `Intercept` transforms it into a decorator for easy application to your controllers or handlers.