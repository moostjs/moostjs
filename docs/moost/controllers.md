# Controllers

## Introduction
In Moost, a controller is a class that groups event handlers together.
Controllers help you organize your code into manageable units, making development more structured and modular. Controllers can be imported into each other, creating a nested hierarchy where child controllers inherit the route prefixes of their parent controllers.

## Define Controller
To define a controller in Moost, you use the `@Controller()` decorator on a class. You can also provide a path prefix as an argument to the decorator, which affects the routes of the handlers within the controller.

::: code-group
```ts [main.controller.ts]
import { Controller, Param } from 'moost'

@Controller('prefix')    // [!code hl]
export class MainController {
    // ...
}
```
:::

## Import Controller
There are multiple ways to import a controller into your Moost application.

The first option is to use the `@ImportController` decorator on another controller or on your own Moost child class.

::: code-group
```ts [main.ts]
import { ImportController } from 'moost'
import { MainController } from './main.controller'

@ImportController(MainController)    // [!code hl]
class MyServer extends Moost {
    // ...
}
```
:::

The second option is to use the `registerControllers` method on your Moost application instance. This is useful when you're not extending the Moost class and instead creating an instance of the original Moost.

```ts
import { Moost } from 'moost'
import { MainController } from './main.controller'

const app = new Moost()
app.registerControllers(MainController) // [!code hl]
// ...
```

The third option allows you to import controllers with a specific instance or a factory callback, giving you more control over controller instantiation. The `@ImportController` decorator can be used with a factory function that returns a new instance of the controller. This approach allows you to provide different instances of the same controller class with different arguments.

::: code-group
```ts [main.ts]
import { ImportController } from 'moost'
import { DbCollection } from './controllers/DbCollection'

@ImportController(() => new DbCollection('users'))    // [!code hl]
@ImportController(() => new DbCollection('roles'))    // [!code hl]
class MyServer extends Moost {
    // ...
}
```
:::

Additionally, the `@ImportController` decorator can be used to overwrite the prefix of the imported controller.

::: code-group
```ts [main.ts]
import { ImportController } from 'moost'
import { MainController } from './main.controller'

@ImportController('new-prefix', MainController)    // [!code hl]
class MyServer extends Moost {
    // ...
}
```
:::

## Controller Scope
By default, controllers in Moost are singleton instances. However, you can create a new instance of a controller for each event by using the `@Injectable('FOR_EVENT')` decorator.

```ts
import { Controller, Injectable, Param } from 'moost'

@Injectable('FOR_EVENT')        // [!code hl]
@Controller('api')
export class MainController {
    @Param('name')
    name = ''

    // ...
}
```
When using the `FOR_EVENT` option, a unique instance of the controller is created for each event. You can use the resolver decorators at the class property level and access them within the event handlers using `this.<prop>`, for example `this.name` as shown in the example. This allows you to maintain separate state or data for each event, providing greater flexibility and customization.

::: warning
It's important to avoid dependencies between controllers with different scopes. If a controller is in the `SINGLETON` scope, it should not depend on a class in the `FOR_EVENT` scope. This is because singleton dependencies are instantiated only once, and it's not possible to create a new instance for each event. However, the reverse scenario is allowed, where a controller in the `FOR_EVENT` scope can depend on a class in the `SINGLETON` scope.
:::