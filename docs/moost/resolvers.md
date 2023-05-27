# Resolvers

Resolvers in Moost are special decorators that facilitate the process of resolving
values into handler arguments or `FOR_EVENT` scoped class properties.
They are an essential part of the Resolver Pipeline, which is automatically applied to every Moost application by default.

## Introduction
Resolvers play a crucial role in simplifying the extraction and transformation of data
that is passed to event handlers or class properties.
They eliminate the need for manual data extraction and provide a convenient way to access
values from different sources within the application.

Moost provides a variety of different resolvers that cater to different use cases.
Some of the commonly used resolvers include:

-   `@Param`: Resolves a route parameter and injects it as an argument into the handler function.
-   `@Params`: Resolves multiple route parameters and constructs an object with the resolved values.
-   `@Const`: Resolves to a provided constant value and injects it as an argument into the handler function or assigns it to a class property.
-   `@ConstFactory`: Resolves to a value returned from a callback function and injects it as an argument into the handler function or assigns it to a class property.
-   `@InjectEventLogger`: Resolves an instance of the Event Logger (from wooks) and injects it as an argument into the handler function or assigns it to a class property.

## Resolve Decorator
At the core of the resolver functionality is the `@Resolve` decorator.
It serves as a foundation for all the listed resolvers above and provides the
underlying implementation for resolving values.
Each resolver decorator is essentially a wrapper on top of the `@Resolve` decorator,
adding specific functionality and customization options.

To demonstrate the creation of a new resolver decorator, let's create a `CurrentDate` resolver:
```ts
import { Get } from '@moostjs/event-http';
import { Resolve, Controller } from 'moost';

const CurrentDate = () => Resolve(() => new Date().toISOString()); // [!code hl]

@Controller()
class MyController {
    @Get()
    handler(@CurrentDate() date: string) {   // [!code hl]
        console.log(date)
    }
}
```
In the above example, we define a new resolver decorator called `CurrentDate`.
This resolver utilizes the `@Resolve` decorator provided by Moost to create a resolver function that returns the current date in ISO string format.

To use the `CurrentDate` resolver, we apply it as a decorator to the date parameter in the handler method of the `MyController` class.
The resolver will automatically invoke the provided callback function `(() => new Date().toISOString())` and inject the result (current date) into the date parameter.

## Should you use resolvers?

DI and resolvers in Moost not only enhance the design of your application and unify data
extractions but also play a crucial role in facilitating effective unit testing.
By utilizing DI and resolvers, you can easily create comprehensive unit tests that ensure the correctness and reliability of your application's logic.

During unit testing, developers can manually create instances of the required classes,
allowing them to provide specific test-case states and achieve precise testing of individual components.
When calling event handlers in unit tests, resolvers are bypassed, giving developers the
freedom to explicitly provide all necessary arguments to the event handler.
This level of control enables isolated testing of specific functionalities and ensures consistent and reliable testing for each test case.
