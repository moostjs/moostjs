# Controllers

::: info
The Controllers in Moost are an integral part of the Dependency Injection functionality.
It is important to have a good understanding of Dependency Injection in general before diving into the details of Controllers.
To familiarize yourself with the concepts and principles of Dependency Injection, we recommend reading the [Dependency Injection documentation](/moost/di/).
This will provide a solid foundation and enhance your understanding of how Controllers leverage Dependency Injection in the Moost framework.
:::

## Introduction

In a Moost application, a controller is a class that groups a set of event handlers.
Controllers allow you to logically organize your code into separate units.
They can be imported into each other, creating a nested hierarchy.
Controllers can also have a prefix that affects the routes of their handlers.
Nested controllers inherit the prefix of their parent controller.

## Define Controller

To define a controller in Moost, you need to annotate a class with the `@Controller()` decorator.
Optionally, you can provide a path prefix as an argument to the decorator.

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

## Import Controller

There are two options for importing a Controller into your Moost application.

The first option is to use the `@ImportController` decorator on another controller or on your own Moost child class.

::: code-group
```ts [server.ts]
import { ImportController } from 'moost'
import { MainController } from './main.controller'

@ImportController(MainController)  // [!code hl]
class MyServer extends Moost {
    //...
}
```
:::

The second option is to use the `registerControllers` method on your Moost application instance.
This option is useful if you're not extending the `Moost` class and instead creating an instance of the original `Moost`.

Here's an example:

::: code-group
```ts{6} [server.ts]
import { MoostHttp } from '@moostjs/event-http'
import { Moost } from 'moost'
import { MainController } from './main.controller'

const app = new Moost()
app.registerControllers(MainController)  // [!code hl]
app.adapter(new MoostHttp()).listen(3000)
app.init()
```
:::

If you run the `server.ts` file with the imported `MainController`, you will see the following lines in your console:

<div class="language-terminal">
<span class="lang">terminal</span>
<pre>
<span class="info">[moost][2023-01-01 12:30:45] Class "MainController" instantiated with: <span class="cyan">[]</span></span>
<span class="info">[moost][2023-01-01 12:30:45] • <span class="cyan">(GET)</span>/api/hello/:name → MainController.<span class="cyan">hello</span>()</span>
</pre>
</div>

This indicates that an instance of the `MainController` class was created during the initialization phase,
and the `/api/hello/:name` route was mapped to the `hello` method of the `MainController`.
Note that the prefix `api` provided in the `@Controller` decorator affected the endpoint path of hello.

## Controller Scope

By default, every controller in Moost is a singleton.
However, it's possible to create a new instance of a controller for each event.
To achieve this, use the `@Injectable` decorator with the argument `'FOR_EVENT'`.

::: code-group
```ts [Diffs]
import { Get } from '@moostjs/event-http'
import {
    Controller,
    Injectable,     // [!code ++]
    Param
} from 'moost'

@Injectable('FOR_EVENT') // [!code ++]
@Controller('api')
export class MainController {
    @Param('name')   // [!code ++]
    name = ''        // [!code ++]
                     // [!code ++]
    @Get('hello/:name')
    hello(@Param('name') name: string) {  // [!code --]
    hello() { // [!code ++]
        return `Hello, ${name}!`  // [!code --]
        return `Hello, ${this.name}!`  // [!code ++]
    }
}
```
```ts [SINGLETON]
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
With `FOR_EVENT` option, the controller instance is unique for each event,
you can use the `@Param('name')` decorator at the class property level
and access it within the event handler using `this.name`.
