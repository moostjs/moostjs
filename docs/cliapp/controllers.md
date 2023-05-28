# Controllers

Just like HTTP controllers in Moost, Moost CLI provides a powerful way to organize command handlers using controllers. A CLI Controller is a class that contains several methods, each of which corresponds to a specific command that can be issued to your CLI application.

## Controller

Defining a CLI controller is very similar to defining an HTTP controller. The class needs to be decorated with the `@Controller()` decorator and methods representing CLI commands are decorated with the `@Cli()` decorator. Let's go over an example to understand this better.

```ts
// ./src/example.controller.ts
import { Controller, Param } from 'moost';
import { Cli } from '@moostjs/event-cli';

@Controller()
export class ExampleController {
    @Cli('greet/:name')
    greet(@Param('name') name: string) {
        return `Hello, ${name}!`;
    }

    @Cli('add/:num1/:num2')
    add(@Param('num1') num1: string, @Param('num2') num2: string) {
        return Number.parseFloat(num1) + Number.parseFloat(num2);
    }
}
```

In the above example, we defined a `ExampleController` with two commands: `greet` and `add`. The `greet` command expects a single parameter `name`, while the `add` command expects two parameters `num1` and `num2`.

## Register Controller

Similar to how HTTP controllers are registered in Moost, CLI controllers also need to be registered before they can be used. We register the CLI controller when setting up the Moost CLI application.

```ts
// ./src/index.ts
import { MoostCli } from '@moostjs/event-cli';
import { Moost } from 'moost';
import { ExampleController } from './src/example.controller';

export function cli() {
    const app = new Moost();

    app.registerControllers(ExampleController);
    app.adapter(new MoostCli());

    app.init();
}
```

In the above example, we registered the `ExampleController` with our Moost CLI application. After registering the controller, the CLI application is ready to handle the `greet` and `add` commands.

## Nested Controllers and Prefixes

In Moost, controllers can be nested to better structure your CLI application.
A controller can be attached or nested within another controller using the `@ImportController(SomeControllerClass)` decorator.
The nested controller will automatically inherit any prefix from the parent controller.

Let's demonstrate this with a simple example:

```ts
// ./src/user.controller.ts
import { Controller, Param } from 'moost';
import { Cli } from '@moostjs/event-cli';

@Controller('user')
export class UserController {
    @Cli('view/:id')
    view(@Param('id') id: string) {
        return `Viewing user with id: ${id}`;
    }
}
```

In this example, we define a `UserController` with the prefix `user`. It has a single command `view` that takes an `id` parameter.

Now, let's create a `ProfileController` that we'll nest within `UserController`:

```ts
// ./src/profile.controller.ts
import { Controller, Param } from 'moost';
import { Cli, ImportController } from '@moostjs/event-cli';
import { UserController } from './user.controller';

@Controller('profile')
@ImportController(UserController)
export class ProfileController {
    @Cli('view/:id')
    view(@Param('id') id: string) {
        return `Viewing profile with id: ${id}`;
    }
}
```

In this `ProfileController`, we use the `@ImportController(UserController)` decorator to nest `UserController` within `ProfileController`.
This way, `UserController` becomes a child of `ProfileController`.

This also means that any command executed within the `UserController` will automatically inherit the prefix from the `ProfileController`.
For example, the `view` command within `UserController` can be accessed using the command `profile user view`.

Let's register our `ProfileController` in our Moost CLI application:

```ts
// ./src/index.ts
import { MoostCli } from '@moostjs/event-cli';
import { Moost } from 'moost';
import { ProfileController } from './src/profile.controller';

export function cli() {
    const app = new Moost();

    app.registerControllers(ProfileController);
    app.adapter(new MoostCli());

    app.init();
}
```

We now have a `ProfileController` that contains the `UserController`.
This creates a hierarchical structure where `UserController` is nested within `ProfileController`.
The commands within `UserController` will all begin with `profile user`, thanks to the prefixes defined in `ProfileController` and `UserController`.

For instance, if you wanted to view a user with the ID of `123`, you'd use the command `profile user view 123`.
The Moost CLI framework automatically concatenates the prefixes from parent and child controllers, along with the command defined in the `@Cli` decorator.

This ability to nest controllers and define prefixes allows you to create complex and well-structured CLI applications.
By utilizing nested controllers and command prefixes, you can build CLI applications that are organized, maintainable, and user-friendly.
