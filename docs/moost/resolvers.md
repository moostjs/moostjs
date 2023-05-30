# Unpacking Resolvers

Resolvers in Moost are decorators with a mission: they bring values into handler arguments or class properties of a `FOR_EVENT` scope. These handy helpers are part of the Resolver Pipeline which every Moost application has as a standard feature.

## What Are Resolvers?

Think of resolvers as special tools that help to pull out data given to event handlers or class properties.
They take away the hassle of having to pull out data yourself and give you an easy way to get values from various places in your application.

Moost comes with a bunch of resolvers ready for different tasks. Some of the ones you might use a lot include:

-   `@Param`: This one gets a route parameter and puts it as an argument into the handler function.
-   `@Params`: This gets more than one route parameters and makes an object with the values it got.
-   `@Const`: It gives a constant value and puts it as an argument into the handler function or assigns it to a class property.
-   `@ConstFactory`: This one gets a value from a callback function and puts it as an argument into the handler function or assigns it to a class property.
-   `@InjectEventLogger`: This gets an instance of the Event Logger and puts it as an argument into the handler function or assigns it to a class property.

## The `@Resolve` Decorator?

The `@Resolve` decorator is the heart of how resolvers work.
It's the base for all the resolvers we've just talked about and does the job of getting values.
Each resolver decorator is like a fancy coat on top of the `@Resolve` decorator, adding extra features and ways to tweak it.

To show you how to make a new resolver decorator, let's make one called `CurrentDate`:
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
In this example, we make a new resolver decorator named `CurrentDate`.
This resolver uses the `@Resolve` decorator given by Moost to make a resolver function that gives the current date in an ISO string format.

When we want to use the `CurrentDate` resolver, we use it as a decorator for the date parameter in the handler method of the `MyController` class.
The resolver will run the callback function `(() => new Date().toISOString())` on its own and put the result (current date) into the date parameter.

## Should I Be Using Resolvers?

Using DI and resolvers in Moost can not only make your application look good and pull out data in the same way,
but it also helps make it easy to do unit testing properly.
With DI and resolvers, you can write unit tests that make sure your application logic works like it should.

During unit testing, developers can make instances of needed classes themselves.
This lets them give specific states for test cases and test individual components exactly.
When running event handlers in unit tests, resolvers get skipped, letting developers give all the needed arguments to the event handler themselves.
This control lets you test specific features in isolation and makes sure testing is consistent and reliable for each test case.
