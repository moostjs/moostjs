# Controller Scope

In Moost, a controller's scope refers to the lifecycle of its instance. There are two primary scopes:

- **SINGLETON**: By default, each Moost controller is a singleton. It means a single controller instance is created and reused for different events. You don't need to do anything for this; it's the default behavior.
- **FOR_EVENT**: A new controller instance is created for each event when its scope is defined as 'FOR_EVENT'. This is useful if you need to maintain a state or use event-based resolvers at the class level during an event's lifecycle.

## Defining 'FOR_EVENT' Scope

To specify a controller's scope as 'FOR_EVENT', apply the `@Injectable('FOR_EVENT')` decorator before the `@Controller()` decorator.

Here's an example:

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

In this case, the `EventController` is defined with 'FOR_EVENT' scope using `@Injectable('FOR_EVENT')` decorator. Because of the 'FOR_EVENT' scope, the `@Param('name')` resolver is usable at the class level. In the `hello` method, `this.name` will contain the 'name' parameter value from the event.

::: warning
Avoid dependencies between controllers with differing scopes. If a controller is in `SINGLETON` scope, it shouldn't depend on a class in `FOR_EVENT` scope. Since singleton dependencies are instantiated only once, creating a new instance for each event isn't possible. However, a controller in `FOR_EVENT` scope can depend on a class in `SINGLETON` scope.
:::