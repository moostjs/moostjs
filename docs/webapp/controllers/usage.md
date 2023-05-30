# Using Controllers

## Define Controller

To create a controller in Moost, we apply the `@Controller()` decorator to a class. This decorator can take an optional argument, which acts as a path prefix for all routes within the controller. 

### Controller with a Prefix

Here's an example of a controller with a prefix:

::: code-group
```ts [api.controller.ts]
import { Get } from '@moostjs/event-http'
import { Controller, Param } from 'moost'

@Controller('api') 
export class ApiController {
    @Get('hello/:name')
    hello(@Param('name') name: string) {
        return `Hello, ${name}!`
    }
}
```
:::

In this case, `ApiController` has the prefix `api`, so the `hello` method goes to the `/api/hello/:name` endpoint.

### Controller without a Prefix

You can also create a controller without a prefix. Then the routes within the controller won't have a path prefix:

::: code-group
```ts [greet.controller.ts]
import { Get } from '@moostjs/event-http'
import { Controller, Param } from 'moost'

@Controller()  
export class GreetController {
    @Get('hello/:name')
    hello(@Param('name') name: string) {
        return `Hello, ${name}!`
    }
}
```
:::

Here, `GreetController` has no prefix, so the `hello` method points to the `/hello/:name` endpoint.

## Register Controller

After defining your controllers, you need to include them in your Moost application. You can do this in two ways:

### Using the `@ImportController` decorator

Apply the `@ImportController` decorator to your Moost child class to import one or more controllers:

::: code-group
```ts [main.ts]
import { Moost } from 'moost'
import { ImportController } from 'moost'
import { ApiController } from './api.controller'

@ImportController(ApiController)   
class MyServer extends Moost {
    // ...
}
```
:::

In this example, `MyServer` application imports `ApiController` using the `@ImportController` decorator.

### Using the `registerControllers` method

The `registerControllers` method allows you to register your controllers with a Moost application instance:

::: code-group
```ts [server.ts]
import { Moost } from 'moost'
import { ApiController } from './api.controller'

const app = new Moost()
app.registerControllers(ApiController) 
// ...
```
:::

Here, the `Moost` application instance registers `ApiController` using the `registerControllers` method.

## Nested Controllers

You can import controllers into each other in Moost to create a nested hierarchy. Nested controllers inherit their parent controllers' route prefixes. Here's an example:

```ts
// user.controller.ts
import { Get } from '@moostjs/event-http'
import { Controller, Param } from 'moost'

@Controller('user')   
export class UserController {
    @Get(':id')
    getUser(@Param('id') id: string) {
        return `User id: ${id}`;
    }
}

// api.controller.ts
import { Controller } from 'moost'
import { ImportController } from '@moostjs/event-http'
import { UserController } from './user.controller'

@Controller('api') 
@ImportController(UserController) 
export class ApiController {}
```

In this case, `UserController` is imported into `ApiController`. With `ApiController` having the prefix `api` and `UserController` the prefix `user`, the `getUser` method of `UserController` points to the `/api/user/:id` endpoint.

By using controllers this way, you can build a clear, easily readable route hierarchy in your Moost app. This method ensures flexible routing logic definition and organized, manageable code.
