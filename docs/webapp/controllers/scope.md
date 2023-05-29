# Scope of Controller

The scope of a controller in Moost refers to the lifecycle of its instance. There are two main types of scopes in Moost:

- **SINGLETON**: By default, every controller in Moost has a singleton scope. This means that a single instance of the controller is created and reused across different events. In fact, you don't need to do anything to create a singleton controller, as it's the default behaviour.
- **FOR_EVENT**: When a controller is defined in the 'FOR_EVENT' scope, a new instance of the controller is created for each event. This can be useful when you need to maintain certain state or use event-based resolvers at the class level during the lifecycle of an event.

## For Event Scope

To define a controller in the 'FOR_EVENT' scope, you need to use the `@Injectable('FOR_EVENT')` decorator before the `@Controller()` decorator.

Let's look at an example:

::: code-group
```ts [event.controller.ts]
import { Get } from '@moostjs/event-http'
import { Controller, Injectable, Param } from 'moost'

@Injectable('FOR_EVENT')    // [!code hl]
@Controller('api')
export class EventController {
    @Param('name') name: string;  // [!code hl]

    @Get('hello/:name')
    hello() {
        return `Hello, ${this.name}!`
    }
}
```
:::

In this example, the `EventController` is defined with the 'FOR_EVENT' scope by using the `@Injectable('FOR_EVENT')` decorator. Because of the 'FOR_EVENT' scope, we can use the `@Param('name')` resolver on the class level. In the `hello` method, `this.name` will contain the value of the 'name' parameter from the event.

::: warning
It's important to avoid dependencies between controllers with different scopes. If a controller is in the `SINGLETON` scope, it should not depend on a class in the `FOR_EVENT` scope.
This is because singleton dependencies are instantiated only once, and it's not possible to create a new instance for each event.
However, the reverse scenario is allowed, where a controller in the `FOR_EVENT` scope can depend on a class in the `SINGLETON` scope.
:::