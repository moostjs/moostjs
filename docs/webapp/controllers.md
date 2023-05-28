# Controllers

::: info
The Controllers in Moost are an integral part of the Dependency Injection functionality.
It is important to have a good understanding of Dependency Injection in general before diving into the details of Controllers.
To familiarize yourself with the concepts and principles of Dependency Injection, we recommend reading the [Dependency Injection documentation](/moost/di/).
This will provide a solid foundation and enhance your understanding of how Controllers leverage Dependency Injection in the Moost framework.
:::

## Introduction

In a Moost application, a controller is a class that groups a set of event handlers.
Controllers enable logical organization of your code into separate units, and with the help of prefixes and nested controllers, you can create complex routing structures.

## Define Controller with Prefix

To define a controller in Moost, you use the `@Controller()` decorator and provide a path prefix as an argument.
This prefix will apply to all routes defined within the controller.

::: code-group
```ts [main.controller.ts]
import { Get } from '@moostjs/event-http'
import { Controller, Param } from 'moost'

@Controller('api')
export class MainController {
    @Get('hello/:name')
    hello(@Param('name') name: string) {
        return `Hello, ${name}!`
    }
}
```
:::

In the above code, `MainController` is defined with a prefix `api`. So the `hello` endpoint becomes `/api/hello/:name`.

## Nested Controllers and Prefix Inheritance

Controllers can be imported into each other, forming a nested hierarchy.
Nested controllers will automatically inherit the prefix of their parent controller.

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
export class ApiController { }
```

In this example, `UserController` is nested inside `ApiController` using `@ImportController(UserController)`.
`UserController` has a prefix `user` and since it is nested within `ApiController` which has a prefix `api`,
any route within `UserController` will have a prefixed path beginning with `api/user`.
So the `getUser` endpoint becomes `/api/user/:id`.

## Importing Controller

There are two options for importing a Controller into your Moost application.

First option is to use the `@ImportController` decorator on another controller or on your Moost child class.

::: code-group
```ts [server.ts]
import { ImportController } from 'moost'
import { ApiController } from './api.controller'

@ImportController(ApiController)
class MyServer extends Moost {
    //...
}
```
:::

The second option is to use the `registerControllers` method on your Moost application instance.
This is useful if you're not extending the `Moost` class and instead creating an instance of the original `Moost`.

::: code-group
```ts{6} [server.ts]
import { MoostHttp } from '@moostjs/event-http'
import { Moost } from 'moost'
import { ApiController } from './api.controller'

const app = new Moost()
app.registerControllers(ApiController)
app.adapter(new MoostHttp()).listen(3000)
app.init()
```
:::

If you run the `server.ts` file with the imported `ApiController`, you will see the following lines in your console:

<div class="language-terminal">
<span class="lang">terminal</span>
<pre>
<span class="info">[moost][2023-01-01 12:30:45] Class "ApiController" instantiated with: <span class="cyan">[]</span></span>
<span class="info">[moost][2023-01-01 12:30:45] • <span class="cyan">(GET)</span>/api/hello/:name → ApiController.<span class="cyan">hello</span>()</span>
</pre>
</div>

This indicates that an instance of the `ApiController` class was created during the initialization phase,
and the `/api/hello/:name` route was mapped to the `hello` method of the `ApiController`.
Note that the prefix `api` provided in the `@Controller` decorator affected the endpoint path of hello.

## Controller Scope

By default, every controller in Moost is a singleton.
However, you can create a new instance of a controller for each event
by using the `@Injectable` decorator with the argument `'FOR_EVENT'`.

::: code-group
```ts [FOR_EVENT]
import { Get } from '@moostjs/event-http'
import { Controller, Injectable, Param } from 'moost'

@Injectable('FOR_EVENT')
@Controller('api')
export class MainController {
    @Param('name')
    name = ''

    @Get('hello/:name')
    hello() {
        return `Hello, ${this.name}!`
    }
}
```
:::

With `FOR_EVENT` option, the controller instance is unique for each event, and you can use the `@Param('name')` decorator at the class property level and access it within the event handler using `this.name`.

Nested controllers and prefixes offer a way to structure your routes in a clean and maintainable manner, making Moost a powerful tool for building well-organized applications.
