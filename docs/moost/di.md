# Dependency Injection

Dependency Injection (DI) is a design pattern that allows the instantiation and management of class instances
to be handled by a framework.
Moost provides built-in support for dependency injection, making it easier to manage and inject dependencies into your application's components.

## Basics of Dependency Injection
At its core, DI simplifies the process of creating and using instances of classes by delegating the responsibility
of instantiation to the framework.
Instead of manually creating instances and managing dependencies, you can rely on the framework to automatically
instantiate and inject the required dependencies.

## Making a Class Injectable
To make a class injectable in Moost, you can use the `@Injectable()` decorator.
By applying this decorator to a class, you indicate that the class should be managed and instantiated by the Moost framework.

Here's an example of how to make a class injectable:
```ts
import { Injectable } from 'moost';

@Injectable()
class MyService {
  // Class implementation
}
```

In the above example, the `MyService` class is decorated with `@Injectable()`,
indicating that it should be managed by the framework.
By default, the class is treated as a singleton, meaning that only one instance
of the class will be created and shared across all injection points.

## Injectable Scope
Moost provides options to control the scope of injectable instances.
By default, an injectable class is treated as a singleton,
meaning that a single instance is created and shared across all injection points.
However, you can also specify the `FOR_EVENT` scope, which creates a new instance for each event.

To specify the scope of an injectable class, you can pass an argument to the `@Injectable()` decorator.
The argument can be either `'SINGLETON'` or `'FOR_EVENT'`.
If no argument is provided, `'SINGLETON'` is used as the default scope.

Here's an example of specifying the scope of an injectable class:
```ts
import { Injectable } from 'moost';

@Injectable(`FOR_EVENT`)
class MyScopedService {
  // Class implementation
}
```
In the above example, the `MyScopedService` class is decorated with `@Injectable('FOR_EVENT')`,
indicating that a new instance of the class should be created for each event within the lifecycle of that event.
This allows the injected instance to behave like a singleton within the scope of a single event.

::: warning
When using Moost's dependency injection, please note that a class with the `SINGLETON` scope should not
depend on a class with the `FOR_EVENT` scope.
This is because singleton dependencies are instantiated only once, and it is not possible to create a new instance for each event.
Therefore, using `FOR_EVENT` dependencies within a `SINGLETON` class will result in the same instance being shared across
multiple events, potentially leading to unexpected behavior.

However, the reverse scenario is allowed and encouraged. Instances with the `FOR_EVENT` scope can depend on instances
with the `SINGLETON` scope without any issues.
The singleton instance will be available throughout the lifecycle of the event, ensuring consistency and predictable behavior.

To ensure proper usage and avoid potential conflicts, it is recommended to carefully manage the dependencies between classes of different scopes.
:::

## Injecting Dependencies
Once a class is marked as injectable, you can easily inject its instance into
other classes or components that require it.
Moost's DI system automatically resolves and injects the dependencies based on the constructor signature.

Here's an example of injecting a dependency:
```ts
import { Injectable } from 'moost';

@Injectable()
class MyService {
  // Class implementation
}

@Controller()
class MyController {
  constructor(private myService: MyService) {
    // Dependency is automatically injected
  }
}
```

In the above example, the `MyController` class has a dependency on `MyService`,
which is marked as injectable.
Moost's DI system automatically resolves the dependency and injects an instance of `MyService` into the constructor of `MyController`.

::: tip
Every controller in Moost is automatically injectable by default.
The `@Controller()` decorator, which is applied to controllers, internally applies the `@Injectable()` decorator.
As a result, there is no need to explicitly use the `@Injectable()` decorator for controllers.
However, if you want a controller to have the `FOR_EVENT` scope, you need to explicitly apply the `@Injectable('FOR_EVENT')` decorator.
:::

By relying on dependency injection, you can easily manage and decouple the dependencies between your classes, promoting modular and reusable code.
