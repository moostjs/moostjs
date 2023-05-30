# Dependency Injection (DI)

Dependency Injection (DI) is a clever trick to help you create and manage classes more easily. Moost comes with built-in support for DI, helping you smoothly handle dependencies in your app.

## DI Basics
DI takes care of making and using class instances for you. So instead of creating and managing these instances yourself, you let the framework do it for you. This simplifies your code and makes everything run more smoothly.

## How to Make a Class Injectable
In Moost, you can use the `@Injectable()` decorator to make a class injectable. When you put this decorator on a class, you're telling Moost to handle that class for you.

Here's how you do it:
```ts
import { Injectable } from 'moost';

@Injectable()
class MyService {
  // The rest of your class
}
```

In this example, the `MyService` class has `@Injectable()`, so Moost will take care of it. Usually, Moost makes one instance of your class and shares it across your whole app.

## Changing Injectable Scope
Moost lets you control how many instances of your injectable class it makes. By default, Moost makes one instance and shares it everywhere (this is called a singleton). But you can also tell Moost to make a new instance for each event.

To do this, you pass an argument to the `@Injectable()` decorator. This argument can be `'SINGLETON'` or `'FOR_EVENT'`. If you don't give an argument, Moost defaults to `'SINGLETON'`.

Here's how to change the scope of an injectable class:
```ts
import { Injectable } from 'moost';

@Injectable(`FOR_EVENT`)
class MyScopedService {
  // The rest of your class
}
```
In this example, the `MyScopedService` class has `@Injectable('FOR_EVENT')`, so Moost makes a new instance of this class for each event. This way, your class works like a singleton for each individual event.

::: warning
When using DI in Moost, a singleton class should not rely on a `FOR_EVENT` class. This is because singleton instances are made once and can't make a new instance for each event. If you try to use a `FOR_EVENT` dependency in a singleton class, the same instance will be used across different events, which can cause problems.

But you can use singleton dependencies in a `FOR_EVENT` class without any trouble. The singleton instance will work as expected during the event. To keep everything running smoothly, make sure to manage dependencies carefully.
:::

## How to Inject Dependencies
After you've made a class injectable, you can inject its instance into other classes or components that need it. Moost's DI system does this for you based on the constructor signature.

Here's how to inject a dependency:
```ts
import { Injectable } from 'moost';

@Injectable()
class MyService {
  // The rest of your class
}

@Controller()
class MyController {
  constructor(private myService: MyService) {
    // Dependency is injected for you
  }
}
```

In this example, the `MyController` class needs `MyService`, which is injectable. Moost's DI system automatically injects an instance of `MyService` into `MyController`.

::: tip
Every controller in Moost is automatically injectable. The `@Controller()` decorator makes this happen. So you don't need to use `@Injectable()` for controllers. But if you want a controller to have the `FOR_EVENT` scope, you need to use `@Injectable('FOR_EVENT')`.
:::

With dependency injection, managing and separating your classes becomes easier, helping you write modular and reusable code.